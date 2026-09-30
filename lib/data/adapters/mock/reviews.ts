import type { ReviewPort } from "@/lib/data/ports";
import {
  DomainError,
  answerQuestion,
  canClientEditReview,
  isWeightLogInWindow,
  markReviewViewed,
  openReview,
  recordMeasurement,
  sendReviewFeedback,
  submitReview,
  weekNumber,
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
    listSubmittedReviews: async (trainerId) =>
      ctx.reply(
        own(ctx.state.reviews, trainerId)
          .filter((r) => r.status === "enviada")
          .sort(bySubmittedDesc),
      ),
    listSubmittedReviewsPage: async (trainerId, query) => {
      const all = own(ctx.state.reviews, trainerId)
        .filter((r) => r.status === "enviada")
        .sort(bySubmittedDesc);

      const total = all.length;
      const start = query.page * query.pageSize;
      const rows = all.slice(start, start + query.pageSize);

      return ctx.reply({ rows, total });
    },
    getCurrentReview: async (trainerId, clientId) => {
      const client = findOwn(ctx.state.clients, trainerId, clientId, "Cliente");
      const week = weekNumber(client.startDate, ctx.state.today, trainerOf(trainerId).timeZone);
      return ctx.reply(
        ctx.state.reviews.find((r) => r.clientId === clientId && r.weekNumber === week) ?? null,
      );
    },
    openCurrentReview: async (trainerId, clientId) => {
      const client = findOwn(ctx.state.clients, trainerId, clientId, "Cliente");
      const trainer = trainerOf(trainerId);
      const week = weekNumber(client.startDate, ctx.state.today, trainer.timeZone);
      // I16: como máximo una revisión por cliente y semana.
      const existing = ctx.state.reviews.find(
        (r) => r.clientId === clientId && r.weekNumber === week,
      );
      if (existing) return ctx.reply(existing);
      const review = openReview({
        client,
        timeZone: trainer.timeZone,
        at: ctx.state.today,
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
      if (changes.measurements) {
        review.measurements = changes.measurements.map(({ measurementTypeId, value }) => {
          const type = findOwn(
            ctx.state.measurementTypes,
            trainerId,
            measurementTypeId,
            "Tipo de medida",
          );
          return recordMeasurement(type, value, ctx.newId);
        });
      }
      if (changes.responses) {
        review.responses = changes.responses.map(({ questionId, value }) => {
          const question = findOwn(ctx.state.questions, trainerId, questionId, "Pregunta");
          return answerQuestion(question, value, ctx.newId);
        });
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
      return ctx.reply(replaceById(ctx.state.reviews, markReviewViewed(review, ctx.now())));
    },
    sendReviewFeedback: async (trainerId, reviewId, feedback) => {
      const review = findOwn(ctx.state.reviews, trainerId, reviewId, "Revisión");
      return ctx.reply(
        replaceById(ctx.state.reviews, sendReviewFeedback(review, feedback, ctx.now())),
      );
    },
  };
}
