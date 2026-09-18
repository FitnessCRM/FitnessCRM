import { z } from "zod";
import {
  externalUrlSchema,
  isoTimestampSchema,
  nonEmptyTextSchema,
  optionalTextSchema,
  tenantFields,
} from "./primitives";

/**
 * Ejercicio de la biblioteca del entrenador. Las rutinas lo referencian por id (I3);
 * el vídeo es siempre un enlace externo (I20).
 */
export const exerciseSchema = z.object({
  ...tenantFields,
  name: nonEmptyTextSchema,
  /** Grupo ("Pierna", "Empuje", "Tracción") y material ("barra"). Texto libre del entrenador. */
  muscleGroup: optionalTextSchema,
  equipment: optionalTextSchema,
  videoUrl: externalUrlSchema.nullable(),
  description: optionalTextSchema,
  createdAt: isoTimestampSchema,
});
export type Exercise = z.infer<typeof exerciseSchema>;
