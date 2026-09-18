import { z } from "zod";
import {
  civilDateSchema,
  idSchema,
  isoTimestampSchema,
  nonEmptyTextSchema,
  optionalTextSchema,
  positiveIntSchema,
  externalUrlSchema,
  tenantFields,
} from "./primitives";
import { scaleFormatSchema, textFormatSchema } from "./questionnaire";

/** Ciclo de vida de la revisión (§7). `completa` NO es un estado: es un atributo derivado (I5). */
export const reviewStatusSchema = z.enum(["borrador", "enviada", "vista", "revisada"]);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

/** Pose de las fotos de composición. Lista cerrada, no configurable (§5). */
export const poseSchema = z.enum(["frente", "perfil", "espalda"]);
export type Pose = z.infer<typeof poseSchema>;
export const POSES: readonly Pose[] = poseSchema.options;

/** Foto de composición corporal. `url` apunta al almacenamiento de la app, no es enlace externo. */
export const reviewMediaSchema = z.object({
  id: idSchema,
  pose: poseSchema,
  url: z.string().min(1),
  uploadedAt: isoTimestampSchema,
});
export type ReviewMedia = z.infer<typeof reviewMediaSchema>;

/**
 * Medida corporal registrada: FK viva al tipo (para comparar entre revisiones) y copia
 * congelada de etiqueta y unidad (para leer el pasado tal y como se midió) — I12.
 */
export const bodyMeasurementSchema = z.object({
  id: idSchema,
  measurementTypeId: idSchema,
  value: z.number(),
  label: nonEmptyTextSchema,
  unit: nonEmptyTextSchema,
});
export type BodyMeasurement = z.infer<typeof bodyMeasurementSchema>;

/**
 * Respuesta del cuestionario: FK viva a la pregunta más enunciado y formato congelados (I12).
 * El valor se valida contra el formato congelado, no contra el catálogo actual.
 */
const responseBase = { id: idSchema, questionId: idSchema, prompt: nonEmptyTextSchema } as const;

export const scaleResponseSchema = z
  .object({ ...responseBase, format: scaleFormatSchema, value: z.int() })
  .refine((r) => r.value >= r.format.min && r.value <= r.format.max, {
    message: "El valor está fuera de la escala de la pregunta",
    path: ["value"],
  });
export const textResponseSchema = z.object({
  ...responseBase,
  format: textFormatSchema,
  value: z.string(),
});
export const questionnaireResponseSchema = z.union([scaleResponseSchema, textResponseSchema]);
export type QuestionnaireResponse = z.infer<typeof questionnaireResponseSchema>;

/** Ventana temporal de la revisión: la semana civil a la que pertenece (I9). */
export const reviewWindowSchema = z
  .object({ start: civilDateSchema, end: civilDateSchema })
  .refine((w) => w.end >= w.start, { message: "Ventana inválida", path: ["end"] });
export type ReviewWindow = z.infer<typeof reviewWindowSchema>;

/**
 * Lo que se exige a la revisión, congelado al abrirla (I5: "exigido al abrirla").
 * Editar el catálogo después no cambia la completitud de esta revisión.
 */
export const reviewRequirementsSchema = z.object({
  measurementTypeIds: z.array(idSchema),
  questionIds: z.array(idSchema),
});
export type ReviewRequirements = z.infer<typeof reviewRequirementsSchema>;

/**
 * Corte semanal. El peso NO vive aquí: se referencia el `WeightLog` de la ventana (§2, I9).
 * `weekNumber` se congela al crearla y no se recalcula (I22).
 */
export const reviewSchema = z.object({
  ...tenantFields,
  clientId: idSchema,
  weekNumber: positiveIntSchema,
  window: reviewWindowSchema,
  status: reviewStatusSchema,
  requirements: reviewRequirementsSchema,
  media: z.array(reviewMediaSchema),
  weightLogId: idSchema.nullable(),
  measurements: z.array(bodyMeasurementSchema),
  responses: z.array(questionnaireResponseSchema),
  /** Feedback del entrenador. El vídeo es enlace externo (I20). */
  feedbackVideoUrl: externalUrlSchema.nullable(),
  feedbackNote: optionalTextSchema,
  createdAt: isoTimestampSchema,
  submittedAt: isoTimestampSchema.nullable(),
  viewedAt: isoTimestampSchema.nullable(),
  reviewedAt: isoTimestampSchema.nullable(),
});
export type Review = z.infer<typeof reviewSchema>;
