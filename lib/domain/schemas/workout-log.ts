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
 * Lleva `exerciseId` propio: es la fila que sobrevive archivada (I13) y la que dice qué se hizo
 * aunque el ejercicio se retire de la rutina. `routineId` y `routineDayExerciseId` dan el
 * contexto (la prescripción) y solo se leen en rutinas archivadas, que no se tocan.
 */
export const workoutLogSchema = z.object({
  ...tenantFields,
  clientId: idSchema,
  exerciseId: idSchema,
  routineId: idSchema,
  routineDayExerciseId: idSchema,
  date: civilDateSchema,
  setNumber: positiveIntSchema,
  weightKg: z.number().nonnegative(),
  reps: z.int().nonnegative(),
  createdAt: isoTimestampSchema,
});
export type WorkoutLog = z.infer<typeof workoutLogSchema>;
