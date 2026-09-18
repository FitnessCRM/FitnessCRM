import { z } from "zod";
import { catalogStatusSchema } from "./catalog";
import {
  isoTimestampSchema,
  nonEmptyTextSchema,
  nonNegativeIntSchema,
  tenantFields,
} from "./primitives";

/**
 * Formato de respuesta (§5): escala con límites del entrenador, o texto libre.
 * Los límites forman parte del formato y por tanto de la inmutabilidad de I15.
 */
export const scaleFormatSchema = z
  .object({ kind: z.literal("escala"), min: z.int(), max: z.int() })
  .refine((f) => f.max > f.min, {
    message: "El máximo de la escala debe ser mayor que el mínimo",
    path: ["max"],
  });
export const textFormatSchema = z.object({ kind: z.literal("texto") });

export const responseFormatSchema = z.discriminatedUnion("kind", [
  scaleFormatSchema,
  textFormatSchema,
]);
export type ResponseFormat = z.infer<typeof responseFormatSchema>;

/** Pregunta del cuestionario, definida por el entrenador. El enunciado es editable siempre (I15). */
export const questionnaireQuestionSchema = z.object({
  ...tenantFields,
  prompt: nonEmptyTextSchema,
  format: responseFormatSchema,
  order: nonNegativeIntSchema,
  status: catalogStatusSchema,
  createdAt: isoTimestampSchema,
});
export type QuestionnaireQuestion = z.infer<typeof questionnaireQuestionSchema>;
