import { doc, setDoc, type Firestore } from "firebase/firestore";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ReviewTrackingFilter } from "@/lib/data/ports";
import { addCivilDays } from "@/lib/domain";
import { createDemoState, createMockPorts, type MockState } from "../mock";
import { CLIENT_IDS, TRAINER_ID } from "../mock/demo-data/common";
import { createMeasurementTypePort, createQuestionnairePort } from "./catalogs";
import { createFirestore } from "./config";
import { createFirebaseContext, type FirebaseContext } from "./context";
import { COLLECTIONS } from "./helpers";
import { createReviewPort, reviewDocId } from "./reviews";

/**
 * Contra el emulador de Firestore (`pnpm test:firebase`). Las lecturas se comparan con el adaptador
 * en memoria sobre los mismos datos de demo; las escrituras comprueban el ciclo de la revisión
 * (§7), las copias congeladas (I12) y las banderas que fijan el formato (I15) y la unidad (I26).
 */
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const TODAY = "2026-10-03";
const NOW = "2026-10-03T10:00:00.000Z";
const STRANGER = "t-otra";

describe.skipIf(!emulatorHost)("adaptador de Firebase · revisiones", () => {
  let db: Firestore;
  let ctx: FirebaseContext;
  let state: MockState;

  beforeAll(() => {
    const [host = "127.0.0.1", port = "8080"] = (emulatorHost as string).split(":");
    db = createFirestore(
      { projectId: "demo-hector" },
      { appName: "firebase-reviews-test", emulator: { host, port: Number(port) } },
    );
  });

  beforeEach(async () => {
    await fetch(
      `http://${emulatorHost}/emulator/v1/projects/demo-hector/databases/(default)/documents`,
      { method: "DELETE" },
    );
    ctx = createFirebaseContext(db, { now: () => NOW });
    state = createDemoState(TODAY);
    // I16: el id de una revisión es `{clientId}_{semana}`. Los de la demo son otros, así que se
    // reescriben igual para los dos adaptadores y las lecturas se pueden comparar.
    for (const r of state.reviews) {
      r.id = reviewDocId(r.clientId, r.weekNumber);
    }
    const seed = (name: string, items: { id: string }[]) =>
      Promise.all(items.map((item) => setDoc(doc(db, name, item.id), item)));
    await seed(COLLECTIONS.trainers, state.trainers);
    await seed(COLLECTIONS.clients, state.clients);
    await seed(COLLECTIONS.measurementTypes, state.measurementTypes);
    await seed(COLLECTIONS.questions, state.questions);
    await seed(COLLECTIONS.weightLogs, state.weightLogs);
    await seed(COLLECTIONS.reviews, state.reviews);
  });

  const mock = () =>
    createMockPorts({ state: structuredClone(state), today: TODAY, now: () => NOW });
  const clientIds = Object.values(CLIENT_IDS);

  /** Un pesaje del cliente en esa fecha, con el id determinista de I23. */
  const weighIn = async (clientId: string, date: string, weightKg: number) => {
    const id = `${clientId}_${date}`;
    await setDoc(doc(db, COLLECTIONS.weightLogs, id), {
      id,
      trainerId: TRAINER_ID,
      clientId,
      date,
      weightKg,
      note: "",
      createdAt: NOW,
    });
    return { id, date, weightKg };
  };

  /** Un cliente en una semana en la que todavía no tiene revisión: donde abrir la de esta semana. */
  const clientWithoutCurrentReview = async () => {
    const reference = mock();
    for (const clientId of clientIds) {
      const client = state.clients.find((c) => c.id === clientId)!;
      if (client.status === "dado_de_baja") continue;
      if ((await reference.reviews.getCurrentReview(TRAINER_ID, clientId)) === null)
        return clientId;
    }
    throw new Error("La demo no tiene un cliente sin revisión de esta semana");
  };

  describe("lecturas iguales que la referencia", () => {
    it("every client's reviews, and getReview by id", async () => {
      const reviews = createReviewPort(ctx);
      const reference = mock().reviews;
      for (const clientId of clientIds) {
        expect(await reviews.listClientReviews(TRAINER_ID, clientId), clientId).toEqual(
          await reference.listClientReviews(TRAINER_ID, clientId),
        );
      }
      const sample = state.reviews[0]!;
      expect(await reviews.getReview(TRAINER_ID, sample.id)).toEqual(sample);
      expect(await reviews.getReview(TRAINER_ID, "no-existe")).toBeNull();
      expect(await reviews.getReview(STRANGER, sample.id)).toBeNull();
    });

    it("the received reviews table, for every filter, search and page", async () => {
      const reviews = createReviewPort(ctx);
      const reference = mock().reviews;
      const filters: ReviewTrackingFilter[] = ["todas", "enviada", "vista", "revisada"];
      for (const filter of filters) {
        for (const search of ["", "mar", "ñ"]) {
          for (const page of [0, 1]) {
            const q = { filter, search, page, pageSize: 3 };
            expect(await reviews.listReviewsTracking(TRAINER_ID, q), JSON.stringify(q)).toEqual(
              await reference.listReviewsTracking(TRAINER_ID, q),
            );
          }
        }
      }
      const all = await reviews.listReviewsTracking(TRAINER_ID, {
        filter: "todas",
        search: "",
        page: 0,
        pageSize: 50,
      });
      expect(all.rows.length).toBeGreaterThan(3);
      expect(all.counts.enviada).toBeGreaterThan(0);
      expect(await reviews.listSubmittedReviews(TRAINER_ID)).toEqual(
        await reference.listSubmittedReviews(TRAINER_ID),
      );
    });

    it("the dashboard figures", async () => {
      const stats = await createReviewPort(ctx).getReviewStats(TRAINER_ID);
      expect(stats).toEqual(await mock().reviews.getReviewStats(TRAINER_ID));
      expect(stats.unviewed).toBeGreaterThan(0);
      expect(await createReviewPort(ctx).getReviewStats(STRANGER)).toEqual({
        unviewed: 0,
        thisWeek: 0,
      });
    });

    it("the current review of each client matches", async () => {
      const reviews = createReviewPort(ctx);
      const reference = mock().reviews;
      for (const clientId of clientIds) {
        expect(await reviews.getCurrentReview(TRAINER_ID, clientId), clientId).toEqual(
          await reference.getCurrentReview(TRAINER_ID, clientId),
        );
      }
      await expect(reviews.getCurrentReview(STRANGER, CLIENT_IDS.marta)).rejects.toMatchObject({
        code: "not_found",
      });
    });
  });

  describe("abrir la revisión de la semana (I16, I22)", () => {
    it("opens one with a fixed week and the active catalog as requirements, and only once", async () => {
      const reviews = createReviewPort(ctx);
      const clientId = await clientWithoutCurrentReview();
      const opened = await reviews.openCurrentReview(TRAINER_ID, clientId);
      expect(opened).toMatchObject({
        status: "borrador",
        clientId,
        trainerId: TRAINER_ID,
        submittedAt: null,
      });
      expect(opened.id).toBe(reviewDocId(clientId, opened.weekNumber));
      expect(opened.requirements.measurementTypeIds.length).toBeGreaterThan(0);
      // Abrirla otra vez devuelve la misma, no una segunda (I16).
      expect((await reviews.openCurrentReview(TRAINER_ID, clientId)).id).toBe(opened.id);
      expect((await reviews.getCurrentReview(TRAINER_ID, clientId))?.id).toBe(opened.id);
      await expect(reviews.openCurrentReview(STRANGER, clientId)).rejects.toMatchObject({
        code: "not_found",
      });
    });
  });

  describe("el borrador del cliente", () => {
    const open = async () => {
      const reviews = createReviewPort(ctx);
      const clientId = await clientWithoutCurrentReview();
      return { reviews, clientId, review: await reviews.openCurrentReview(TRAINER_ID, clientId) };
    };

    it("freezes label and unit when a measurement is recorded, and keeps them if the type changes (I12)", async () => {
      const { reviews, review } = await open();
      const typeId = review.requirements.measurementTypeIds[0]!;
      const type = state.measurementTypes.find((t) => t.id === typeId)!;
      const saved = await reviews.updateReviewDraft(TRAINER_ID, review.id, {
        measurements: [{ measurementTypeId: typeId, value: 80 }],
      });
      expect(saved.measurements[0]).toMatchObject({
        measurementTypeId: typeId,
        value: 80,
        label: type.label,
        unit: type.unit,
      });
      await createMeasurementTypePort(ctx).updateMeasurementType(TRAINER_ID, typeId, {
        label: "Renombrada",
      });
      const again = await reviews.updateReviewDraft(TRAINER_ID, review.id, {
        measurements: [{ measurementTypeId: typeId, value: 80 }],
      });
      expect(again.measurements[0]!.label).toBe(type.label); // la copia congelada no se toca
    });

    it("recording a measurement locks the unit of its type, and an answer locks the question's format (I26, I15)", async () => {
      const { reviews, review } = await open();
      const types = createMeasurementTypePort(ctx);
      const questions = createQuestionnairePort(ctx);
      const typeId = review.requirements.measurementTypeIds[0]!;
      const question = state.questions.find((q) => review.requirements.questionIds.includes(q.id))!;
      expect(await types.measurementTypeHasMeasurements(TRAINER_ID, typeId)).toBe(false);
      await reviews.updateReviewDraft(TRAINER_ID, review.id, {
        measurements: [{ measurementTypeId: typeId, value: 70 }],
        responses: [
          {
            questionId: question.id,
            value: question.format.kind === "escala" ? question.format.min : "bien",
          },
        ],
      });
      expect(await types.measurementTypeHasMeasurements(TRAINER_ID, typeId)).toBe(true);
      expect(await questions.questionHasResponses(TRAINER_ID, question.id)).toBe(true);
      await expect(
        types.updateMeasurementType(TRAINER_ID, typeId, { unit: "zzz" }),
      ).rejects.toMatchObject({ code: "measurement_type.unit_locked" });
    });

    it("rejects a weight outside the window (I9) and one that is not the client's own", async () => {
      const { reviews, review } = await open();
      const outside = await weighIn(review.clientId, addCivilDays(review.window.start, -30), 70);
      await expect(
        reviews.updateReviewDraft(TRAINER_ID, review.id, { weightLogId: outside.id }),
      ).rejects.toMatchObject({ code: "review.weight_out_of_window" });
      const inside = await weighIn(review.clientId, review.window.start, 70);
      const saved = await reviews.updateReviewDraft(TRAINER_ID, review.id, {
        weightLogId: inside.id,
      });
      expect(saved.weightLogId).toBe(inside.id);
      await expect(
        reviews.updateReviewDraft(TRAINER_ID, review.id, { weightLogId: "no-existe" }),
      ).rejects.toMatchObject({ code: "not_found" });
      await expect(
        reviews.updateReviewDraft(STRANGER, review.id, { weightLogId: null }),
      ).rejects.toMatchObject({ code: "not_found" });
    });

    it("attaches a photo per pose, replacing the previous one of that pose", async () => {
      const { reviews, review } = await open();
      await reviews.attachReviewMedia(TRAINER_ID, review.id, "frente", "blob:uno");
      const second = await reviews.attachReviewMedia(TRAINER_ID, review.id, "frente", "blob:dos");
      await reviews.attachReviewMedia(TRAINER_ID, review.id, "perfil", "blob:tres");
      expect(second.media.filter((m) => m.pose === "frente").map((m) => m.url)).toEqual([
        "blob:dos",
      ]);
      const after = await reviews.getReview(TRAINER_ID, review.id);
      expect(after?.media.map((m) => m.pose).sort()).toEqual(["frente", "perfil"]);
    });
  });

  describe("el ciclo borrador → enviada → vista → revisada", () => {
    it("walks the whole life of a review, and locks it for the client once seen (I17)", async () => {
      const { reviews, clientId, review } = await (async () => {
        const reviews = createReviewPort(ctx);
        const clientId = await clientWithoutCurrentReview();
        return { reviews, clientId, review: await reviews.openCurrentReview(TRAINER_ID, clientId) };
      })();
      await expect(reviews.markReviewViewed(TRAINER_ID, review.id)).rejects.toMatchObject({
        code: "review.invalid_transition",
      });
      const sent = await reviews.submitReview(TRAINER_ID, review.id);
      expect(sent).toMatchObject({ status: "enviada", submittedAt: NOW });
      // Enviada todavía se edita (I17).
      await reviews.updateReviewDraft(TRAINER_ID, review.id, { measurements: [] });

      const seen = await reviews.markReviewViewed(TRAINER_ID, review.id);
      expect(seen).toMatchObject({ status: "vista", viewedAt: NOW, frozenWeight: null });
      await expect(
        reviews.updateReviewDraft(TRAINER_ID, review.id, { measurements: [] }),
      ).rejects.toMatchObject({ code: "review.locked" });
      await expect(
        reviews.attachReviewMedia(TRAINER_ID, review.id, "frente", "x"),
      ).rejects.toMatchObject({
        code: "review.locked",
      });

      await expect(
        reviews.sendReviewFeedback(TRAINER_ID, review.id, {
          videoUrl: "javascript:alert(1)",
          note: "",
        }),
      ).rejects.toMatchObject({ code: "review.feedback_invalid_url" });
      const done = await reviews.sendReviewFeedback(TRAINER_ID, review.id, {
        videoUrl: "https://example.com/v",
        note: "Muy bien",
      });
      expect(done).toMatchObject({ status: "revisada", feedbackNote: "Muy bien", reviewedAt: NOW });
      expect((await reviews.listClientReviews(TRAINER_ID, clientId))[0]!.id).toBe(review.id);
    });

    it("freezes the weight the review pointed at when it is seen (I24)", async () => {
      const reviews = createReviewPort(ctx);
      const clientId = await clientWithoutCurrentReview();
      const review = await reviews.openCurrentReview(TRAINER_ID, clientId);
      const log = await weighIn(clientId, review.window.start, 71.4);
      await reviews.updateReviewDraft(TRAINER_ID, review.id, { weightLogId: log.id });
      await reviews.submitReview(TRAINER_ID, review.id);
      const seen = await reviews.markReviewViewed(TRAINER_ID, review.id);
      expect(seen.frozenWeight).toEqual({ weightKg: 71.4, date: log.date });
      // Si el pesaje se corrige después, la revisión vista conserva su copia (I24).
      await weighIn(clientId, review.window.start, 99);
      expect((await reviews.getReview(TRAINER_ID, review.id))?.frozenWeight?.weightKg).toBe(71.4);
    });

    it("a trainer cannot touch another's review", async () => {
      const reviews = createReviewPort(ctx);
      const clientId = await clientWithoutCurrentReview();
      const review = await reviews.openCurrentReview(TRAINER_ID, clientId);
      for (const call of [
        () => reviews.submitReview(STRANGER, review.id),
        () => reviews.markReviewViewed(STRANGER, review.id),
        () => reviews.sendReviewFeedback(STRANGER, review.id, { videoUrl: null, note: "" }),
        () => reviews.attachReviewMedia(STRANGER, review.id, "frente", "x"),
      ]) {
        await expect(call()).rejects.toMatchObject({ code: "not_found" });
      }
    });
  });
});
