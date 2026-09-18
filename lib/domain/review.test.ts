import { describe, expect, it } from "vitest";
import {
  NOW,
  TZ,
  client,
  completeReview,
  idFactory,
  measurementType,
  media,
  question,
  review,
  weightLog,
} from "./__tests__/fixtures";
import { DomainError } from "./errors";
import {
  answerQuestion,
  canClientEditReview,
  isReviewComplete,
  markReviewViewed,
  openReview,
  recordMeasurement,
  sendReviewFeedback,
  submitReview,
  weightForReview,
} from "./review";

describe("I5 · isReviewComplete", () => {
  it("is complete with 3 photos, weight, every required measurement and every required answer", () => {
    const result = isReviewComplete(completeReview());
    expect(result.complete).toBe(true);
    expect(result.blocks).toEqual({
      photos: true,
      weight: true,
      measurements: true,
      questionnaire: true,
    });
  });

  it("reports exactly what is missing, not just a boolean", () => {
    const r = review({ media: [media("frente")] });
    const result = isReviewComplete(r);
    expect(result.complete).toBe(false);
    expect(result.missing).toEqual({
      poses: ["perfil", "espalda"],
      weight: true,
      measurementTypeIds: ["mt-cintura"],
      questionIds: ["q-energia"],
    });
  });

  it("counts completed blocks like the UI (2 of 4)", () => {
    const r = completeReview({ measurements: [], responses: [] });
    const blocks = Object.values(isReviewComplete(r).blocks).filter(Boolean).length;
    expect(blocks).toBe(2);
  });

  it("checks against the requirements frozen when the review was opened, not the current catalog", () => {
    const r = completeReview();
    // El entrenador añade "Cadera" hoy: la revisión de ayer sigue completa.
    expect(isReviewComplete(r).complete).toBe(true);
    // Solo si se le pasan explícitamente requisitos nuevos deja de estarlo.
    const withNewCatalog = isReviewComplete(r, {
      measurementTypeIds: ["mt-cintura", "mt-cadera"],
      questionIds: ["q-energia"],
    });
    expect(withNewCatalog.complete).toBe(false);
    expect(withNewCatalog.missing.measurementTypeIds).toEqual(["mt-cadera"]);
  });

  it("treats a blank text answer as unanswered", () => {
    const r = completeReview({
      requirements: { measurementTypeIds: ["mt-cintura"], questionIds: ["q-texto"] },
      responses: [
        {
          id: "qr",
          questionId: "q-texto",
          prompt: "¿Cómo?",
          format: { kind: "texto" },
          value: "  ",
        },
      ],
    });
    expect(isReviewComplete(r).missing.questionIds).toEqual(["q-texto"]);
  });

  it("does not block submission: an incomplete review can be submitted and is 'parcial'", () => {
    const r = review({ media: [media("frente")] });
    const sent = submitReview(r, NOW);
    expect(sent.status).toBe("enviada");
    expect(isReviewComplete(sent).complete).toBe(false);
  });
});

describe("I17 · canClientEditReview", () => {
  it("allows editing while borrador or enviada", () => {
    expect(canClientEditReview(review({ status: "borrador" }))).toBe(true);
    expect(canClientEditReview(review({ status: "enviada" }))).toBe(true);
  });

  it("closes editing once the trainer marks it vista, and stays closed after feedback", () => {
    expect(canClientEditReview(review({ status: "vista" }))).toBe(false);
    expect(canClientEditReview(review({ status: "revisada" }))).toBe(false);
  });

  it("has no time cap: an enviada review the trainer never opens stays editable", () => {
    const old = review({ status: "enviada", submittedAt: "2026-01-01T00:00:00Z" });
    expect(canClientEditReview(old)).toBe(true);
  });
});

describe("I9 · weightForReview", () => {
  const window = { start: "2026-08-29", end: "2026-09-04" };

  it("picks the most recent log inside the window", () => {
    const logs = [
      weightLog({ id: "a", date: "2026-08-29", weightKg: 63.4 }),
      weightLog({ id: "b", date: "2026-08-31", weightKg: 63.2 }),
      weightLog({ id: "c", date: "2026-08-26", weightKg: 63.8 }),
    ];
    expect(weightForReview(logs, window)?.id).toBe("b");
  });

  it("returns null when every log is outside the window", () => {
    const logs = [weightLog({ date: "2026-08-26" }), weightLog({ id: "z", date: "2026-09-05" })];
    expect(weightForReview(logs, window)).toBeNull();
  });

  it("includes both window edges", () => {
    expect(weightForReview([weightLog({ date: "2026-08-29" })], window)).not.toBeNull();
    expect(weightForReview([weightLog({ date: "2026-09-04" })], window)).not.toBeNull();
  });

  it("breaks same-day ties by creation time", () => {
    const logs = [
      weightLog({ id: "early", date: "2026-08-29", createdAt: "2026-08-29T06:00:00Z" }),
      weightLog({ id: "late", date: "2026-08-29", createdAt: "2026-08-29T20:00:00Z" }),
    ];
    expect(weightForReview(logs, window)?.id).toBe("late");
  });
});

describe("I22 · weekNumber is frozen at creation", () => {
  const catalog = { measurementTypes: [measurementType()], questions: [question()] };

  it("openReview computes the week once from the client's start date", () => {
    const r = openReview({
      client,
      timeZone: TZ,
      at: "2026-08-29",
      ...catalog,
      newId: idFactory(),
      now: NOW,
    });
    expect(r.weekNumber).toBe(5);
    expect(r.window).toEqual({ start: "2026-08-29", end: "2026-09-04" });
  });

  it("changing the client's start date afterwards does not relabel the stored review", () => {
    const r = openReview({
      client,
      timeZone: TZ,
      at: "2026-08-29",
      ...catalog,
      newId: idFactory(),
      now: NOW,
    });
    const moved = { ...client, startDate: "2026-08-15" };
    // Una revisión nueva se numeraría distinto…
    const fresh = openReview({
      client: moved,
      timeZone: TZ,
      at: "2026-08-29",
      ...catalog,
      newId: idFactory(),
      now: NOW,
    });
    expect(fresh.weekNumber).toBe(3);
    // …pero la existente conserva su número: es un dato almacenado, no derivado.
    expect(r.weekNumber).toBe(5);
    const viewed = markReviewViewed(submitReview(r, NOW), NOW);
    expect(viewed.weekNumber).toBe(5);
  });

  it("freezes the ACTIVE catalog entries as requirements (I5 'exigido al abrirla')", () => {
    const r = openReview({
      client,
      timeZone: TZ,
      at: "2026-08-29",
      measurementTypes: [
        measurementType({ id: "mt-cadera", label: "Cadera", order: 1 }),
        measurementType({ id: "mt-cintura", order: 0 }),
        measurementType({ id: "mt-viejo", label: "Antiguo", status: "archivada" }),
      ],
      questions: [question(), question({ id: "q-old", status: "archivada" })],
      newId: idFactory(),
      now: NOW,
    });
    expect(r.requirements).toEqual({
      measurementTypeIds: ["mt-cintura", "mt-cadera"],
      questionIds: ["q-energia"],
    });
  });
});

describe("I12 · frozen copies of catalog text", () => {
  it("a measurement keeps the label and unit in force when it was recorded", () => {
    const type = measurementType();
    const bm = recordMeasurement(type, 71, idFactory());
    type.label = "Cintura (ombligo)";
    type.unit = "mm";
    expect(bm).toMatchObject({
      measurementTypeId: "mt-cintura",
      value: 71,
      label: "Cintura",
      unit: "cm",
    });
  });

  it("a response keeps prompt and format; editing the question later does not alter it", () => {
    const q = question();
    const res = answerQuestion(q, 4, idFactory());
    q.prompt = "Energía (nueva redacción)";
    q.format = { kind: "escala", min: 1, max: 10 };
    expect(res.prompt).toBe("Energía en los entrenos");
    expect(res.format).toEqual({ kind: "escala", min: 1, max: 5 });
    expect(res.value).toBe(4);
  });

  it("validates the answer against the question's format", () => {
    expect(() => answerQuestion(question(), 6, idFactory())).toThrow(DomainError);
    expect(() => answerQuestion(question(), "cuatro", idFactory())).toThrow(DomainError);
    const text = question({ id: "q-t", format: { kind: "texto" } });
    expect(() => answerQuestion(text, 3, idFactory())).toThrow(DomainError);
    expect(answerQuestion(text, "Bien", idFactory()).value).toBe("Bien");
  });
});

describe("review lifecycle: borrador → enviada → vista → revisada", () => {
  it("walks the happy path and stamps each timestamp", () => {
    const sent = submitReview(review(), "2026-08-29T08:00:00Z");
    const viewed = markReviewViewed(sent, "2026-08-29T10:00:00Z");
    const done = sendReviewFeedback(
      viewed,
      { videoUrl: "https://youtu.be/x", note: "Sube carbos" },
      "2026-08-30T09:00:00Z",
    );
    expect(sent.submittedAt).toBe("2026-08-29T08:00:00Z");
    expect(viewed.viewedAt).toBe("2026-08-29T10:00:00Z");
    expect(done).toMatchObject({
      status: "revisada",
      feedbackVideoUrl: "https://youtu.be/x",
      feedbackNote: "Sube carbos",
    });
  });

  it("rejects skipping or repeating states", () => {
    expect(() => markReviewViewed(review(), NOW)).toThrow(DomainError);
    expect(() => submitReview(review({ status: "enviada" }), NOW)).toThrow(DomainError);
    expect(() =>
      sendReviewFeedback(review({ status: "enviada" }), { videoUrl: null, note: "" }, NOW),
    ).toThrow(DomainError);
  });
});
