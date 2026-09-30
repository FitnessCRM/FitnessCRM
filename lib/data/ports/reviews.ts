import type { Pose, Review, ReviewDraft, ReviewFeedback } from "@/lib/domain";

/** Lo que el cliente puede rellenar mientras la revisión sigue editable (I17). */
export type ReviewDraftChanges = ReviewDraft;

/** Consulta paginada de revisiones recibidas para el dashboard. */
export interface SubmittedReviewsQuery {
  page: number;
  pageSize: number;
}

/** Página de revisiones enviadas con metadatos. */
export interface SubmittedReviewsPage {
  rows: Review[];
  total: number;
}

/** Cifras de revisiones de toda la cartera para el panel de control. */
export interface ReviewStats {
  /** Revisiones `enviada` que el entrenador aún no ha abierto. */
  unviewed: number;
  /** Revisiones enviadas en los últimos 7 días, sea cual sea su estado actual. */
  thisWeek: number;
}

export interface ReviewPort {
  listClientReviews(trainerId: string, clientId: string): Promise<Review[]>;
  getReview(trainerId: string, reviewId: string): Promise<Review | null>;
  /** Revisiones `enviada` de toda la cartera: la lista "Revisiones recibidas" del panel. */
  listSubmittedReviews(trainerId: string): Promise<Review[]>;
  /** Página de revisiones `enviada` con paginación en servidor. */
  listSubmittedReviewsPage(
    trainerId: string,
    query: SubmittedReviewsQuery,
  ): Promise<SubmittedReviewsPage>;
  /** Contadores de la cartera entera, calculados donde están los datos y no sobre una página. */
  getReviewStats(trainerId: string): Promise<ReviewStats>;
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
