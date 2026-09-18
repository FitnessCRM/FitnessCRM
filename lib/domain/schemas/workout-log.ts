import { z } from "zod";
import {
  civilDateSchema,
  idSchema,
  isoTimestampSchema,
  positiveIntSchema,
  tenantFields,
} from "./primitives";

/**
 * Serie realmente ejecutada por el cliente. Opcional, suelta, nunca bloquea nada (§2).
 * Referencia la prescripción para poder leerla en su contexto aunque la rutina se archive.
 */
export const workoutLogSchema = z.object({
  ...tenantFields,
  clientId: idSchema,
  routineId: idSchema,
  routineDayExerciseId: idSchema,
  date: civilDateSchema,
  setNumber: positiveIntSchema,
  weightKg: z.number().nonnegative(),
  reps: z.int().nonnegative(),
  createdAt: isoTimestampSchema,
});
export type WorkoutLog = z.infer<typeof workoutLogSchema>;
