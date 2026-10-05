import {
  collection,
  getCountFromServer,
  getDoc,
  query,
  runTransaction,
  where,
  type Transaction,
} from "firebase/firestore";
import type { ReviewPort, ReviewTrackingFilter } from "@/lib/data/ports";
import {
  DomainError,
  canClientEditReview,
  civilDateInTimeZone,
  clientSchema,
  freezeMeasurements,
  freezeResponses,
  isWeightLogInWindow,
  markReviewViewed,
  measurementTypeSchema,
  openReview,
  questionnaireQuestionSchema,
  reviewSchema,
  sendReviewFeedback,
  submitReview,
  trainerSchema,
  weekNumber,
  weekNumberOrNull,
  weightLogSchema,
  type Review,
} from "@/lib/domain";
import type { FirebaseContext } from "./context";
import {
  COLLECTIONS,
  FLAGS,
  listOwn,
  notFound,
  readOwn,
  ref,
  requireOwn,
  txRequireOwn,
} from "./helpers";

/**
 * I16: una revisión por cliente y semana. El id del documento es `{clientId}_{semana}`, así que
 * abrir la de esta semana dos veces cae sobre el mismo documento, y las reglas de seguridad lo
 * comprueban al crearla.
 */
export const reviewDocId = (clientId: string, week: number) => `${clientId}_${week}`;

const bySubmittedDesc = <T extends { submittedAt: string | null }>(a: T, b: T) =>
  (b.submittedAt ?? "").localeCompare(a.submittedAt ?? "");

/** Las revisiones que ve el entrenador: los borradores los rellena el cliente y no se reciben. */
const RECEIVED = ["enviada", "vista", "revisada"];

export function createReviewPort(ctx: FirebaseContext): ReviewPort {
  const name = COLLECTIONS.reviews;

  const trainerOf = async (trainerId: string) => {
    const snap = await getDoc(ref(ctx, COLLECTIONS.trainers, trainerId));
    if (!snap.exists()) throw notFound("Entrenador", trainerId);
    return trainerSchema.parse({ ...snap.data(), id: snap.id });
  };
  /** «Hoy» en la zona del entrenador, con el reloj de esta llamada: no se fija al arrancar (E12). */
  const todayOf = (timeZone: string) => civilDateInTimeZone(ctx.now(), timeZone);

  const reviewRef = (reviewId: string) => ref(ctx, name, reviewId);

  /** La revisión que el cliente aún puede editar (I17), leída dentro de una transacción. */
  const editableIn = async (
    tx: Transaction,
    trainerId: string,
    reviewId: string,
  ): Promise<Review> => {
    const { value } = await txRequireOwn(
      tx,
      reviewRef(reviewId),
      reviewSchema,
      trainerId,
      "Revisión",
    );
    if (!canClientEditReview(value)) {
      throw new DomainError("review.locked", "La revisión ya no se puede editar (I17)");
    }
    return value;
  };

  const receivedOf = (trainerId: string) =>
    listOwn(ctx, name, reviewSchema, trainerId, where("status", "in", RECEIVED));

  return {
    listClientReviews: async (trainerId, clientId) =>
      (await listOwn(ctx, name, reviewSchema, trainerId, where("clientId", "==", clientId))).sort(
        (a, b) => b.weekNumber - a.weekNumber,
      ),

    getReview: (trainerId, reviewId) => readOwn(ctx, name, reviewSchema, trainerId, reviewId),

    listSubmittedReviews: async (trainerId) =>
      (await listOwn(ctx, name, reviewSchema, trainerId, where("status", "==", "enviada"))).sort(
        bySubmittedDesc,
      ),

    listReviewsTracking: async (trainerId, q) => {
      const fold = (text: string) =>
        text
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase();
      const needle = fold(q.search.trim());
      const [clients, received] = await Promise.all([
        listOwn(ctx, COLLECTIONS.clients, clientSchema, trainerId),
        receivedOf(trainerId),
      ]);
      const named = received.flatMap((review) => {
        const client = clients.find((c) => c.id === review.clientId);
        return client && fold(`${client.firstName} ${client.lastName}`).includes(needle)
          ? [{ review, client }]
          : [];
      });
      const counts: Record<ReviewTrackingFilter, number> = {
        todas: named.length,
        enviada: named.filter((r) => r.review.status === "enviada").length,
        vista: named.filter((r) => r.review.status === "vista").length,
        revisada: named.filter((r) => r.review.status === "revisada").length,
      };
      const rows = named
        .filter((r) => q.filter === "todas" || r.review.status === q.filter)
        .sort(
          (a, b) =>
            Number(b.review.status === "enviada") - Number(a.review.status === "enviada") ||
            bySubmittedDesc(a.review, b.review),
        )
        .slice(q.page * q.pageSize, (q.page + 1) * q.pageSize);
      return { rows, counts };
    },

    // Dos cuentas de servidor, sin traer ni un documento. La segunda mezcla igualdad y rango, así que
    // necesita el índice compuesto de `firestore.indexes.json`.
    getReviewStats: async (trainerId) => {
      const col = collection(ctx.db, name);
      const weekAgo = new Date(new Date(ctx.now()).getTime() - 7 * 24 * 60 * 60 * 1000);
      const [unviewed, thisWeek] = await Promise.all([
        getCountFromServer(
          query(col, where("trainerId", "==", trainerId), where("status", "==", "enviada")),
        ),
        getCountFromServer(
          query(
            col,
            where("trainerId", "==", trainerId),
            where("submittedAt", ">=", weekAgo.toISOString()),
          ),
        ),
      ]);
      return { unviewed: unviewed.data().count, thisWeek: thisWeek.data().count };
    },

    getCurrentReview: async (trainerId, clientId) => {
      const client = await requireOwn(
        ctx,
        COLLECTIONS.clients,
        clientSchema,
        trainerId,
        clientId,
        "Cliente",
      );
      // Antes del alta no hay semana, así que tampoco revisión de esta semana (§8).
      const { timeZone } = await trainerOf(trainerId);
      const week = weekNumberOrNull(client.startDate, todayOf(timeZone), timeZone);
      if (week === null) return null;
      return readOwn(ctx, name, reviewSchema, trainerId, reviewDocId(clientId, week));
    },

    openCurrentReview: async (trainerId, clientId) => {
      const client = await requireOwn(
        ctx,
        COLLECTIONS.clients,
        clientSchema,
        trainerId,
        clientId,
        "Cliente",
      );
      const trainer = await trainerOf(trainerId);
      const today = todayOf(trainer.timeZone);
      const week = weekNumber(client.startDate, today, trainer.timeZone);
      const id = reviewDocId(clientId, week);
      // Los catálogos activos de ahora son los requisitos congelados de esta revisión (I5).
      const [measurementTypes, questions] = await Promise.all([
        listOwn(ctx, COLLECTIONS.measurementTypes, measurementTypeSchema, trainerId),
        listOwn(ctx, COLLECTIONS.questions, questionnaireQuestionSchema, trainerId),
      ]);
      return runTransaction(ctx.db, async (tx) => {
        const snap = await tx.get(reviewRef(id));
        // I16: como máximo una revisión por cliente y semana.
        if (snap.exists()) return reviewSchema.parse({ ...snap.data(), id: snap.id });
        const review = reviewSchema.parse({
          ...openReview({
            client,
            timeZone: trainer.timeZone,
            at: today,
            measurementTypes,
            questions,
            newId: ctx.newId,
            now: ctx.now(),
          }),
          id,
        });
        tx.set(reviewRef(id), review);
        return review;
      });
    },

    updateReviewDraft: async (trainerId, reviewId, changes) => {
      // Primero de quién es, después qué trae: así no se dice nada de lo ajeno.
      await requireOwn(ctx, name, reviewSchema, trainerId, reviewId, "Revisión");
      const [types, questions, log] = await Promise.all([
        changes.measurements
          ? listOwn(ctx, COLLECTIONS.measurementTypes, measurementTypeSchema, trainerId)
          : [],
        changes.responses
          ? listOwn(ctx, COLLECTIONS.questions, questionnaireQuestionSchema, trainerId)
          : [],
        changes.weightLogId
          ? requireOwn(
              ctx,
              COLLECTIONS.weightLogs,
              weightLogSchema,
              trainerId,
              changes.weightLogId,
              "Pesaje",
            )
          : null,
      ]);
      return runTransaction(ctx.db, async (tx) => {
        const review = await editableIn(tx, trainerId, reviewId);
        const next: Review = { ...review };
        if (changes.weightLogId !== undefined) {
          // I9: el peso de la revisión cae dentro de su ventana.
          if (log && !isWeightLogInWindow(log, review.window)) {
            throw new DomainError("review.weight_out_of_window", "El pesaje no está en la ventana");
          }
          next.weightLogId = changes.weightLogId;
        }
        // I12: solo se recongela lo nuevo o lo que cambia de valor.
        if (changes.measurements) {
          next.measurements = freezeMeasurements(
            review.measurements,
            changes.measurements,
            (id) => {
              const type = types.find((t) => t.id === id);
              if (!type) throw notFound("Tipo de medida", id);
              return type;
            },
            ctx.newId,
          );
        }
        if (changes.responses) {
          next.responses = freezeResponses(
            review.responses,
            changes.responses,
            (id) => {
              const question = questions.find((q) => q.id === id);
              if (!question) throw notFound("Pregunta", id);
              return question;
            },
            ctx.newId,
          );
        }
        const parsed = reviewSchema.parse(next);
        tx.set(reviewRef(reviewId), parsed);
        // I26 e I15: desde la primera medida o respuesta, la unidad y el formato quedan fijos. Las
        // banderas se suben en la misma transacción que guarda el valor, y solo las de lo que existe.
        for (const m of changes.measurements ?? []) {
          if (types.some((t) => t.id === m.measurementTypeId)) {
            tx.update(ref(ctx, COLLECTIONS.measurementTypes, m.measurementTypeId), {
              [FLAGS.hasMeasurements]: true,
            });
          }
        }
        for (const r of changes.responses ?? []) {
          if (questions.some((q) => q.id === r.questionId)) {
            tx.update(ref(ctx, COLLECTIONS.questions, r.questionId), {
              [FLAGS.hasResponses]: true,
            });
          }
        }
        return parsed;
      });
    },

    attachReviewMedia: (trainerId, reviewId, pose, url) =>
      runTransaction(ctx.db, async (tx) => {
        const review = await editableIn(tx, trainerId, reviewId);
        const next = reviewSchema.parse({
          ...review,
          media: [
            ...review.media.filter((m) => m.pose !== pose),
            { id: ctx.newId(), pose, url, uploadedAt: ctx.now() },
          ],
        });
        tx.set(reviewRef(reviewId), next);
        return next;
      }),

    submitReview: (trainerId, reviewId) =>
      runTransaction(ctx.db, async (tx) => {
        const { value } = await txRequireOwn(
          tx,
          reviewRef(reviewId),
          reviewSchema,
          trainerId,
          "Revisión",
        );
        const next = reviewSchema.parse(submitReview(value, ctx.now()));
        tx.set(reviewRef(reviewId), next);
        return next;
      }),

    markReviewViewed: async (trainerId, reviewId) => {
      // I24: la copia del peso sale del pesaje al que apunta en este momento.
      const seen = await requireOwn(ctx, name, reviewSchema, trainerId, reviewId, "Revisión");
      return runTransaction(ctx.db, async (tx) => {
        const { value } = await txRequireOwn(
          tx,
          reviewRef(reviewId),
          reviewSchema,
          trainerId,
          "Revisión",
        );
        const logRefId = seen.weightLogId;
        const log =
          logRefId === null
            ? null
            : (
                await txRequireOwn(
                  tx,
                  ref(ctx, COLLECTIONS.weightLogs, logRefId),
                  weightLogSchema,
                  trainerId,
                  "Pesaje",
                )
              ).value;
        const next = reviewSchema.parse(markReviewViewed(value, log, ctx.now()));
        tx.set(reviewRef(reviewId), next);
        return next;
      });
    },

    sendReviewFeedback: (trainerId, reviewId, feedback) =>
      runTransaction(ctx.db, async (tx) => {
        const { value } = await txRequireOwn(
          tx,
          reviewRef(reviewId),
          reviewSchema,
          trainerId,
          "Revisión",
        );
        const next = reviewSchema.parse(sendReviewFeedback(value, feedback, ctx.now()));
        tx.set(reviewRef(reviewId), next);
        return next;
      }),
  };
}
