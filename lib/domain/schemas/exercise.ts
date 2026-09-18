import { z } from "zod";
import {
  externalUrlSchema,
  isoTimestampSchema,
  nonEmptyTextSchema,
  optionalTextSchema,
  tenantFields,
} from "./primitives";

/** Ciclo de vida del ejercicio (§7). "Eliminar" en la UI es archivar: la fila sobrevive (I13). */
export const exerciseStatusSchema = z.enum(["activo", "archivado"]);
export type ExerciseStatus = z.infer<typeof exerciseStatusSchema>;

/**
 * Ejercicio de la biblioteca del entrenador. Las rutinas lo referencian por id (I3);
 * el vídeo es siempre un enlace externo (I20). Archivarlo lo saca de la biblioteca y de las
 * rutinas, pero un WorkoutLog antiguo sigue pudiendo decir qué ejercicio se hizo.
 */
export const exerciseSchema = z.object({
  ...tenantFields,
  name: nonEmptyTextSchema,
  /** Grupo ("Pierna", "Empuje", "Tracción") y material ("barra"). Texto libre del entrenador. */
  muscleGroup: optionalTextSchema,
  equipment: optionalTextSchema,
  videoUrl: externalUrlSchema.nullable(),
  description: optionalTextSchema,
  status: exerciseStatusSchema,
  createdAt: isoTimestampSchema,
});
export type Exercise = z.infer<typeof exerciseSchema>;
