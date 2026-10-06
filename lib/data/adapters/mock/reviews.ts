import type { ReviewPort, ReviewTrackingFilter } from "@/lib/data/ports";
import {
  DomainError,
  canClientEditReview,
  civilDateInTimeZone,
  freezeMeasurements,
  freezeResponses,
  isWeightLogInWindow,
  markReviewViewed,
  openReview,
  sendReviewFeedback,
  submitReview,
  weekNumber,
  weekNumberOrNull,
} from "@/lib/domain";
import { findOwn, own, replaceById } from "./helpers";
import type { MockContext } from "./store";

const bySubmittedDesc = <T extends { submittedAt: string | null }>(a: T, b: T) =>
  (b.submittedAt ?? "").localeCompare(a.submittedAt ?? "");

export function createReviewPort(ctx: MockContext): ReviewPort {
  const trainerOf = (trainerId: string) => {
    const trainer = ctx.state.trainers.find((t) => t.id === trainerId);
    if (!trainer) throw new DomainError("not_found", `Entrenador ${trainerId} no existe`);
    return trainer;
  };
  /** «Hoy» en la zona del entrenador, con el reloj de esta llamada: no se fija al arrancar (E12). */
  const todayOf = (timeZone: string) => civilDateInTimeZone(ctx.now(), timeZone);
  const editable = (trainerId: string, reviewId: string) => {
    const review = findOwn(ctx.state.reviews, trainerId, reviewId, "Revisión");
    if (!canClientEditReview(review)) {
      throw new DomainError("review.locked", "La revisión ya no se puede editar (I17)");
    }
    return review;
  };

  return {
    listClientReviews: async (trainerId, clientId) =>
      ctx.reply(
        own(ctx.state.reviews, trainerId)
          .filter((r) => r.clientId === clientId)
          .sort((a, b) => b.weekNumber - a.weekNumber),
      ),
    getReview: async (trainerId, reviewId) =>
      ctx.reply(
        ctx.state.reviews.find((r) => r.id === reviewId && r.trainerId === trainerId) ?? null,
      ),
    listReviewsTracking: async (trainerId, query) => {
      const fold = (text: string) =>
        text
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase();
      const needle = fold(query.search.trim());
      const clients = own(ctx.state.clients, trainerId);
      // Los borradores los rellena el cliente: el entrenador solo ve lo que se le ha enviado.
      const named = own(ctx.state.reviews, trainerId).flatMap((review) => {
        const client = clients.find((c) => c.id === review.clientId);
        return review.status !== "borrador" &&
          client &&
          fold(`${client.firstName} ${client.lastName}`).includes(needle)
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
        .filter((r) => query.filter === "todas" || r.review.status === query.filter)
        .sort(
          (a, b) =>
            Number(b.review.status === "enviada") - Number(a.review.status === "enviada") ||
            bySubmittedDesc(a.review, b.review),
        )
        .slice(query.page * query.pageSize, (query.page + 1) * query.pageSize);
      return ctx.reply({ rows, counts });
    },
    getReviewStats: async (trainerId) => {
      const all = own(ctx.state.reviews, trainerId);
      const weekAgo = new Date(ctx.now()).getTime() - 7 * 24 * 60 * 60 * 1000;
      return ctx.reply({
        unviewed: all.filter((r) => r.status === "enviada").length,
        thisWeek: all.filter((r) => r.submittedAt !== null && Date.parse(r.submittedAt) >= weekAgo)
          .length,
      });
    },
    getCurrentReview: async (trainerId, clientId) => {
      const client = findOwn(ctx.state.clients, trainerId, clientId, "Cliente");
      // Antes del alta no hay semana, así que tampoco revisión de esta semana (§8).
      const { timeZone } = trainerOf(trainerId);
      const week = weekNumberOrNull(client.startDate, todayOf(timeZone), timeZone);
      if (week === null) return ctx.reply(null);
      return ctx.reply(
        ctx.state.reviews.find((r) => r.clientId === clientId && r.weekNumber === week) ?? null,
      );
    },
    openCurrentReview: async (trainerId, clientId) => {
      const client = findOwn(ctx.state.clients, trainerId, clientId, "Cliente");
      const trainer = trainerOf(trainerId);
      const today = todayOf(trainer.timeZone);
      const week = weekNumber(client.startDate, today, trainer.timeZone);
      // I16: como máximo una revisión por cliente y semana.
      const existing = ctx.state.reviews.find(
        (r) => r.clientId === clientId && r.weekNumber === week,
      );
      if (existing) return ctx.reply(existing);
      const review = openReview({
        client,
        timeZone: trainer.timeZone,
        at: today,
        measurementTypes: own(ctx.state.measurementTypes, trainerId),
        questions: own(ctx.state.questions, trainerId),
        newId: ctx.newId,
        now: ctx.now(),
      });
      ctx.state.reviews.push(review);
      return ctx.reply(review);
    },
    updateReviewDraft: async (trainerId, reviewId, changes) => {
      const review = editable(trainerId, reviewId);
      if (changes.weightLogId !== undefined) {
        if (changes.weightLogId !== null) {
          const log = findOwn(ctx.state.weightLogs, trainerId, changes.weightLogId, "Pesaje");
          // I9: el peso de la revisión cae dentro de su ventana.
          if (!isWeightLogInWindow(log, review.window)) {
            throw new DomainError("review.weight_out_of_window", "El pesaje no está en la ventana");
          }
        }
        review.weightLogId = changes.weightLogId;
      }
      // I12: solo se recongela lo nuevo o lo que cambia de valor.
      if (changes.measurements) {
        review.measurements = freezeMeasurements(
          review.measurements,
          changes.measurements,
          (id) => findOwn(ctx.state.measurementTypes, trainerId, id, "Tipo de medida"),
          ctx.newId,
        );
      }
      if (changes.responses) {
        review.responses = freezeResponses(
          review.responses,
          changes.responses,
          (id) => findOwn(ctx.state.questions, trainerId, id, "Pregunta"),
          ctx.newId,
        );
      }
      return ctx.reply(review);
    },
    attachReviewMedia: async (trainerId, reviewId, pose, url) => {
      const review = editable(trainerId, reviewId);
      review.media = [
        ...review.media.filter((m) => m.pose !== pose),
        { id: ctx.newId(), pose, url, uploadedAt: ctx.now() },
      ];
      return ctx.reply(review);
    },
    submitReview: async (trainerId, reviewId) => {
      const review = findOwn(ctx.state.reviews, trainerId, reviewId, "Revisión");
      return ctx.reply(replaceById(ctx.state.reviews, submitReview(review, ctx.now())));
    },
    markReviewViewed: async (trainerId, reviewId) => {
      const review = findOwn(ctx.state.reviews, trainerId, reviewId, "Revisión");
      // I24: la copia del peso sale del pesaje al que apunta en este momento.
      const log =
        review.weightLogId === null
          ? null
          : findOwn(ctx.state.weightLogs, trainerId, review.weightLogId, "Pesaje");
      return ctx.reply(replaceById(ctx.state.reviews, markReviewViewed(review, log, ctx.now())));
    },
    sendReviewFeedback: async (trainerId, reviewId, feedback) => {
      const review = findOwn(ctx.state.reviews, trainerId, reviewId, "Revisión");
      return ctx.reply(
        replaceById(ctx.state.reviews, sendReviewFeedback(review, feedback, ctx.now())),
      );
    },
  };
}
