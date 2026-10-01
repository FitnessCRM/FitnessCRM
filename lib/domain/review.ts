import { DomainError } from "./errors";
import {
  POSES,
  type BodyMeasurement,
  type CivilDate,
  type Client,
  type FrozenWeight,
  type MeasurementType,
  type Pose,
  type QuestionnaireQuestion,
  type QuestionnaireResponse,
  type Review,
  type ReviewRequirements,
  type ReviewStatus,
  type ReviewWindow,
  type WeightLog,
} from "./schemas";
import { reviewWindowForWeek, weekNumber } from "./week";

/* ---------- I5 · Completitud (atributo derivado, nunca estado) ---------- */

export type ReviewBlock = "photos" | "weight" | "measurements" | "questionnaire";

export interface ReviewCompleteness {
  complete: boolean;
  blocks: Record<ReviewBlock, boolean>;
  missing: {
    poses: Pose[];
    weight: boolean;
    measurementTypeIds: string[];
    questionIds: string[];
  };
}

/**
 * Una revisión está completa ⟺ 3 fotos (una por pose) + peso en ventana + un valor por cada tipo
 * de medida exigido al abrirla + una respuesta por cada pregunta exigida al abrirla.
 * Se comprueba contra los requisitos congelados, no contra el catálogo actual. La completitud
 * avisa pero no bloquea el envío.
 */
export function isReviewComplete(
  review: Review,
  requirements: ReviewRequirements = review.requirements,
): ReviewCompleteness {
  const uploaded = new Set(review.media.map((m) => m.pose));
  const poses = POSES.filter((p) => !uploaded.has(p));

  const measured = new Set(review.measurements.map((m) => m.measurementTypeId));
  const measurementTypeIds = requirements.measurementTypeIds.filter((id) => !measured.has(id));

  const answered = new Set(
    review.responses
      .filter((r) => (typeof r.value === "string" ? r.value.trim().length > 0 : true))
      .map((r) => r.questionId),
  );
  const questionIds = requirements.questionIds.filter((id) => !answered.has(id));

  const weight = review.weightLogId === null;

  const blocks: Record<ReviewBlock, boolean> = {
    photos: poses.length === 0,
    weight: !weight,
    measurements: measurementTypeIds.length === 0,
    questionnaire: questionIds.length === 0,
  };

  return {
    complete: Object.values(blocks).every(Boolean),
    blocks,
    missing: { poses, weight, measurementTypeIds, questionIds },
  };
}

/* ---------- I17 · Edición del cliente ---------- */

/** El cliente edita hasta que el entrenador la marca como `vista`. Sin tope temporal. */
export function canClientEditReview(review: Pick<Review, "status">): boolean {
  return review.status === "borrador" || review.status === "enviada";
}

/* ---------- I9 · Peso de la revisión ---------- */

export function isWeightLogInWindow(log: Pick<WeightLog, "date">, window: ReviewWindow): boolean {
  return log.date >= window.start && log.date <= window.end;
}

/**
 * El pesaje que tomará la revisión cuando el cliente la guarde: el `WeightLog` más reciente cuya
 * fecha cae dentro de la ventana. No es el peso de la revisión, que es `reviewWeight` (I24): la
 * revisión no sigue sola al último de la ventana, cambia de pesaje cuando se vuelve a guardar.
 * Devuelve `null` si no hay ninguno: el cliente tendrá que pesarse (o enviar sin peso).
 */
export function weightForReview(
  weightLogs: readonly WeightLog[],
  window: ReviewWindow,
): WeightLog | null {
  let best: WeightLog | null = null;
  for (const log of weightLogs) {
    if (!isWeightLogInWindow(log, window)) continue;
    const newer =
      best === null ||
      log.date > best.date ||
      (log.date === best.date && log.createdAt > best.createdAt);
    if (newer) best = log;
  }
  return best;
}

/* ---------- I24 · Peso de la revisión: referencia mientras es editable, copia desde `vista` ---------- */

/**
 * El peso de la revisión. En `borrador` y `enviada`, el del pesaje al que apunta (si el cliente lo
 * corrige, la revisión lo refleja); en `vista` y `revisada`, la copia que guardó al pasar a `vista`,
 * aunque el pesaje se haya corregido después. Nunca el último pesaje de la ventana.
 */
export function reviewWeight(
  review: Pick<Review, "status" | "weightLogId" | "frozenWeight">,
  logs: readonly WeightLog[],
): FrozenWeight | null {
  if (!canClientEditReview(review)) return review.frozenWeight;
  const log = logs.find((l) => l.id === review.weightLogId);
  return log ? { weightKg: log.weightKg, date: log.date } : null;
}

/* ---------- I25 · Un pesaje en uso no se borra ---------- */

/**
 * Un pesaje al que apunta una revisión `enviada`, `vista` o `revisada` no se puede borrar. Si solo
 * lo usa un borrador, sí: el borrador se queda sin peso. Rige en el uso normal de la app; el
 * borrado a petición se lleva revisiones y pesajes a la vez y no pasa por aquí (§7, §9).
 */
export function assertWeightLogDeletable(
  weightLogId: string,
  reviews: readonly Pick<Review, "status" | "weightLogId">[],
): void {
  if (reviews.some((r) => r.weightLogId === weightLogId && r.status !== "borrador")) {
    throw new DomainError(
      "weight_log.in_review",
      "El pesaje lo usa una revisión enviada y no se puede borrar (I25)",
    );
  }
}

/* ---------- Apertura: congela semana (I22) y requisitos (I5) ---------- */

export interface OpenReviewInput {
  client: Pick<Client, "id" | "trainerId" | "startDate">;
  timeZone: string;
  /** Instante o fecha civil en que se abre. */
  at: Date | CivilDate;
  measurementTypes: readonly MeasurementType[];
  questions: readonly QuestionnaireQuestion[];
  newId: () => string;
  now: string;
}

/**
 * Crea una revisión en `borrador`. `weekNumber` y la ventana se calculan una sola vez;
 * los requisitos se toman de las entradas ACTIVAS del catálogo en este momento.
 */
export function openReview(input: OpenReviewInput): Review {
  const week = weekNumber(input.client.startDate, input.at, input.timeZone);
  return {
    id: input.newId(),
    trainerId: input.client.trainerId,
    clientId: input.client.id,
    weekNumber: week,
    window: reviewWindowForWeek(input.client.startDate, week),
    status: "borrador",
    requirements: {
      measurementTypeIds: input.measurementTypes
        .filter((t) => t.status === "activa")
        .sort((a, b) => a.order - b.order)
        .map((t) => t.id),
      questionIds: input.questions
        .filter((q) => q.status === "activa")
        .sort((a, b) => a.order - b.order)
        .map((q) => q.id),
    },
    media: [],
    weightLogId: null,
    frozenWeight: null,
    measurements: [],
    responses: [],
    feedbackVideoUrl: null,
    feedbackNote: "",
    createdAt: input.now,
    submittedAt: null,
    viewedAt: null,
    reviewedAt: null,
  };
}

/* ---------- I12 · Copias congeladas ---------- */

/** Registra un valor copiando etiqueta y unidad vigentes. Editar el tipo después no lo altera. */
export function recordMeasurement(
  type: Pick<MeasurementType, "id" | "label" | "unit">,
  value: number,
  newId: () => string,
): BodyMeasurement {
  return { id: newId(), measurementTypeId: type.id, value, label: type.label, unit: type.unit };
}

/** Responde copiando enunciado y formato vigentes. El valor se valida contra ese formato. */
export function answerQuestion(
  question: Pick<QuestionnaireQuestion, "id" | "prompt" | "format">,
  value: number | string,
  newId: () => string,
): QuestionnaireResponse {
  const base = { id: newId(), questionId: question.id, prompt: question.prompt };
  if (question.format.kind === "escala") {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      throw new DomainError("response.not_integer", "Una escala se responde con un entero");
    }
    if (value < question.format.min || value > question.format.max) {
      throw new DomainError("response.out_of_range", "El valor está fuera de la escala");
    }
    return { ...base, format: { ...question.format }, value };
  }
  if (typeof value !== "string") {
    throw new DomainError("response.not_text", "Una pregunta de texto se responde con texto");
  }
  return { ...base, format: { kind: "texto" }, value };
}

/* ---------- Ciclo de vida: borrador → enviada → vista → revisada ---------- */

const TRANSITIONS: Record<ReviewStatus, ReviewStatus | null> = {
  borrador: "enviada",
  enviada: "vista",
  vista: "revisada",
  revisada: null,
};

function assertTransition(review: Review, to: ReviewStatus): void {
  if (TRANSITIONS[review.status] !== to) {
    throw new DomainError(
      "review.invalid_transition",
      `No se puede pasar de ${review.status} a ${to}`,
    );
  }
}

/** El cliente envía, completa o no. La completitud no bloquea (§1.8). */
export function submitReview(review: Review, now: string): Review {
  assertTransition(review, "enviada");
  return { ...review, status: "enviada", submittedAt: now };
}

/**
 * El entrenador la abre: apaga "Nueva" y cierra la edición del cliente (I17). Guarda copia del peso
 * y de la fecha del pesaje al que apunta (I24); `weightLog` tiene que ser ese pesaje, o `null` si la
 * revisión no tiene peso.
 */
export function markReviewViewed(review: Review, weightLog: WeightLog | null, now: string): Review {
  assertTransition(review, "vista");
  if ((weightLog?.id ?? null) !== review.weightLogId) {
    throw new DomainError(
      "review.weight_log_mismatch",
      "El pesaje no es el que referencia la revisión",
    );
  }
  return {
    ...review,
    status: "vista",
    viewedAt: now,
    frozenWeight: weightLog ? { weightKg: weightLog.weightKg, date: weightLog.date } : null,
  };
}

export interface ReviewFeedback {
  videoUrl: string | null;
  note: string;
}

/** El entrenador envía feedback: la revisión pasa a `revisada`. */
export function sendReviewFeedback(review: Review, feedback: ReviewFeedback, now: string): Review {
  assertTransition(review, "revisada");
  return {
    ...review,
    status: "revisada",
    feedbackVideoUrl: feedback.videoUrl,
    feedbackNote: feedback.note,
    reviewedAt: now,
  };
}

/* ---------- Borrador del cliente: vista previa tolerante ---------- */

/** Lo que el cliente rellena en su pantalla. Es el mismo contrato que usa el puerto. */
export interface ReviewDraft {
  weightLogId?: string | null;
  measurements?: { measurementTypeId: string; value: number }[];
  responses?: { questionId: string; value: number | string }[];
}

export interface ReviewCatalog {
  measurementTypes: readonly Pick<MeasurementType, "id" | "label" | "unit">[];
  questions: readonly Pick<QuestionnaireQuestion, "id" | "prompt" | "format">[];
}

/**
 * Aplica un borrador a la revisión sin persistir y sin lanzar: las entradas inválidas
 * (valor fuera de escala, tipo desconocido) se omiten. Sirve para calcular la completitud en
 * vivo mientras el cliente escribe; la escritura real sigue siendo estricta en el puerto.
 */
export function applyReviewDraft(
  review: Review,
  draft: ReviewDraft,
  catalog: ReviewCatalog,
): Review {
  let n = 0;
  const previewId = () => `preview-${++n}`;
  const next: Review = { ...review };
  if (draft.weightLogId !== undefined) next.weightLogId = draft.weightLogId;
  if (draft.measurements) {
    next.measurements = draft.measurements.flatMap(({ measurementTypeId, value }) => {
      const type = catalog.measurementTypes.find((t) => t.id === measurementTypeId);
      return type && Number.isFinite(value) ? [recordMeasurement(type, value, previewId)] : [];
    });
  }
  if (draft.responses) {
    next.responses = draft.responses.flatMap(({ questionId, value }) => {
      const question = catalog.questions.find((q) => q.id === questionId);
      if (!question) return [];
      try {
        return [answerQuestion(question, value, previewId)];
      } catch (error) {
        if (error instanceof DomainError) return [];
        throw error;
      }
    });
  }
  return next;
}
