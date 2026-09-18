import type { Pose, Review, ReviewFeedback } from "@/lib/domain";

/** Lo que el cliente puede rellenar mientras la revisión sigue editable (I17). */
export interface ReviewDraftChanges {
  weightLogId?: string | null;
  measurements?: { measurementTypeId: string; value: number }[];
  responses?: { questionId: string; value: number | string }[];
}

export interface ReviewPort {
  listClientReviews(trainerId: string, clientId: string): Promise<Review[]>;
  getReview(trainerId: string, reviewId: string): Promise<Review | null>;
  /** Revisiones `enviada` de toda la cartera: la lista "Revisiones recibidas" del panel. */
  listSubmittedReviews(trainerId: string): Promise<Review[]>;
  /** Abre (o devuelve) el borrador de la semana actual del cliente. Congela semana y catálogo. */
  openCurrentReview(trainerId: string, clientId: string): Promise<Review>;
  updateReviewDraft(
    trainerId: string,
    reviewId: string,
    changes: ReviewDraftChanges,
  ): Promise<Review>;
  /** Registra una foto de una pose; sustituye la anterior de esa pose si la había. */
  attachReviewMedia(trainerId: string, reviewId: string, pose: Pose, url: string): Promise<Review>;
  submitReview(trainerId: string, reviewId: string): Promise<Review>;
  markReviewViewed(trainerId: string, reviewId: string): Promise<Review>;
  sendReviewFeedback(
    trainerId: string,
    reviewId: string,
    feedback: ReviewFeedback,
  ): Promise<Review>;
}
