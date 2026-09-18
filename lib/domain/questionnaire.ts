import type { QuestionnaireQuestion, ResponseFormat } from "./schemas";

/** Dos formatos son iguales si coinciden en tipo y, en escala, en límites. */
export function formatsAreEqual(a: ResponseFormat, b: ResponseFormat): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "escala" && b.kind === "escala") return a.min === b.min && a.max === b.max;
  return true;
}

/**
 * I15: el formato (tipo y límites) es inmutable desde que existe la primera respuesta.
 * El enunciado se puede editar siempre; eso no pasa por aquí.
 */
export function canChangeQuestionFormat(
  question: QuestionnaireQuestion,
  hasResponses: boolean,
): boolean {
  void question;
  return !hasResponses;
}

/** Comprueba una edición completa: permitida si no toca el formato o si aún no hay respuestas. */
export function canUpdateQuestion(
  question: QuestionnaireQuestion,
  next: Pick<QuestionnaireQuestion, "prompt" | "format">,
  hasResponses: boolean,
): boolean {
  if (formatsAreEqual(question.format, next.format)) return true;
  return canChangeQuestionFormat(question, hasResponses);
}
