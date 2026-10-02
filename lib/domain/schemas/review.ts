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
  weightKgSchema,
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

/** Copia del peso que la revisión guarda al pasar a `vista` (I24): kg y fecha del pesaje. */
export const frozenWeightSchema = z.object({ weightKg: weightKgSchema, date: civilDateSchema });
export type FrozenWeight = z.infer<typeof frozenWeightSchema>;

/**
 * Corte semanal. Mientras es editable, el peso no vive aquí: se referencia el `WeightLog` de la
 * ventana (§2, I9). Al pasar a `vista` guarda copia en `frozenWeight` y desde entonces se lee de
 * ella (I24). `weekNumber` se congela al crearla y no se recalcula (I22).
 */
export const reviewObjectSchema = z.object({
  ...tenantFields,
  clientId: idSchema,
  weekNumber: positiveIntSchema,
  window: reviewWindowSchema,
  status: reviewStatusSchema,
  requirements: reviewRequirementsSchema,
  media: z.array(reviewMediaSchema),
  weightLogId: idSchema.nullable(),
  /** Nula mientras la revisión es editable; en `vista` y `revisada`, la copia de I24. */
  frozenWeight: frozenWeightSchema.nullable(),
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

/**
 * I24: editable ⇒ sin copia; `vista` o `revisada` ⇒ copia si y solo si la revisión tenía pesaje.
 * La regla vive aparte del objeto para que `reviewObjectSchema` se pueda seguir recortando.
 */
export const reviewSchema = reviewObjectSchema.superRefine((review, ctx) => {
  const editable = review.status === "borrador" || review.status === "enviada";
  const expected = editable ? false : review.weightLogId !== null;
  if ((review.frozenWeight !== null) !== expected) {
    ctx.addIssue({
      code: "custom",
      message: editable
        ? "Una revisión editable no guarda copia del peso"
        : "Una revisión vista guarda copia del peso si y solo si tenía pesaje",
      path: ["frozenWeight"],
    });
  }
});
export type Review = z.infer<typeof reviewSchema>;
