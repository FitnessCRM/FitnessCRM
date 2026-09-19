import type { Pose, Review, ReviewDraft, ReviewFeedback } from "@/lib/domain";

/** Lo que el cliente puede rellenar mientras la revisión sigue editable (I17). */
export type ReviewDraftChanges = ReviewDraft;

export interface ReviewPort {
  listClientReviews(trainerId: string, clientId: string): Promise<Review[]>;
  getReview(trainerId: string, reviewId: string): Promise<Review | null>;
  /** Revisiones `enviada` de toda la cartera: la lista "Revisiones recibidas" del panel. */
  listSubmittedReviews(trainerId: string): Promise<Review[]>;
  /** La revisión de la semana actual del cliente si existe. Solo lectura: nunca crea nada. */
  getCurrentReview(trainerId: string, clientId: string): Promise<Review | null>;
  /**
   * Abre (o devuelve) la revisión de la semana actual, congelando semana y catálogo. Se llama
   * en la primera edición real del cliente, no al visitar la pantalla: una fila vacía ocuparía
   * el hueco de I16 y el congelado marcaría "visitó" en vez de "empezó".
   */
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
