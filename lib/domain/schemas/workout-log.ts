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
 * aunque el ejercicio se retire de la rutina. `routineId` dice en qué versión de la rutina se
 * hizo, que no se toca al archivarse; `routineDayExerciseId` dice en qué línea, y como las líneas
 * conservan su id entre versiones (§7), es lo que casa la serie con la versión activa.
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
