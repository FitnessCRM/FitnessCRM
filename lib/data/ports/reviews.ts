import type { Client, Pose, Review, ReviewDraft, ReviewFeedback } from "@/lib/domain";

/** Lo que el cliente puede rellenar mientras la revisión sigue editable (I17). */
export type ReviewDraftChanges = ReviewDraft;

/** Cifras de revisiones de toda la cartera para el panel de control. */
export interface ReviewStats {
  /** Revisiones `enviada` que el entrenador aún no ha abierto. */
  unviewed: number;
  /** Revisiones enviadas en los últimos 7 días, sea cual sea su estado actual. */
  thisWeek: number;
}

/** Corte por estado de las revisiones recibidas (`/reviews`). Los borradores no se reciben. */
export type ReviewTrackingFilter = "todas" | "enviada" | "vista" | "revisada";

/** Consulta paginada en servidor de todas las revisiones recibidas. */
export interface ReviewTrackingQuery {
  filter: ReviewTrackingFilter;
  /** Texto libre sobre el nombre del cliente; sin tildes ni mayúsculas. Vacío: sin búsqueda. */
  search: string;
  /** Página, desde 0. */
  page: number;
  pageSize: number;
}

export interface ReviewTrackingRow {
  review: Review;
  client: Client;
}

export interface ReviewTrackingPage {
  /** Solo la página pedida. Orden: las nuevas primero y luego las más recientes. */
  rows: ReviewTrackingRow[];
  /** Cuántas hay por estado dentro de la búsqueda, sin paginar: los contadores de los chips. */
  counts: Record<ReviewTrackingFilter, number>;
}

export interface ReviewPort {
  listClientReviews(trainerId: string, clientId: string): Promise<Review[]>;
  getReview(trainerId: string, reviewId: string): Promise<Review | null>;
  /** Todas las revisiones recibidas (no borradores): filtra, busca, ordena y pagina en servidor. */
  listReviewsTracking(trainerId: string, query: ReviewTrackingQuery): Promise<ReviewTrackingPage>;
  /** Contadores de la cartera entera, calculados donde están los datos y no sobre una página. */
  getReviewStats(trainerId: string): Promise<ReviewStats>;
  /**
   * La revisión de la semana actual del cliente si existe. Solo lectura: nunca crea nada. Antes del
   * alta no hay semana (§8): devuelve `null`.
   */
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
