import { z } from "zod";
import { planStatusSchema } from "./plan-status";
import {
  idSchema,
  isoTimestampSchema,
  nonEmptyTextSchema,
  optionalTextSchema,
  positiveIntSchema,
  tenantFields,
} from "./primitives";

/**
 * Prescripción de un ejercicio (§5). `repsMax` nulo = reps fijas.
 * RIR y descanso son texto libre a propósito: "1-2", "el que necesites".
 */
export const prescriptionSchema = z
  .object({
    sets: positiveIntSchema,
    repsMin: positiveIntSchema,
    repsMax: positiveIntSchema.nullable(),
    rir: optionalTextSchema,
    rest: optionalTextSchema,
    note: optionalTextSchema,
  })
  .refine((p) => p.repsMax === null || p.repsMax >= p.repsMin, {
    message: "El máximo de repeticiones no puede ser menor que el mínimo",
    path: ["repsMax"],
  });
export type Prescription = z.infer<typeof prescriptionSchema>;

/** Ejercicio prescrito dentro de un día. Nunca en la misma tabla que `WorkoutLog` (§2). */
export const routineDayExerciseSchema = z.object({
  id: idSchema,
  exerciseId: idSchema,
  prescription: prescriptionSchema,
});
export type RoutineDayExercise = z.infer<typeof routineDayExerciseSchema>;

/** Día numérico (Día 1, Día 2…) con etiqueta opcional ("Torso"). El orden es el del array. */
export const routineDaySchema = z.object({
  id: idSchema,
  dayNumber: positiveIntSchema,
  label: optionalTextSchema,
  exercises: z.array(routineDayExerciseSchema),
});
export type RoutineDay = z.infer<typeof routineDaySchema>;

const uniqueDayNumbers = (days: { dayNumber: number }[]) =>
  new Set(days.map((d) => d.dayNumber)).size === days.length;

/** Estructura común a rutina de cliente y plantilla de rutina. */
export const routineBodySchema = z.object({
  name: nonEmptyTextSchema,
  /** Nota del entrenador visible para el cliente en su pantalla de rutina. */
  note: optionalTextSchema,
  days: z.array(routineDaySchema).refine(uniqueDayNumbers, {
    message: "No puede haber dos días con el mismo número",
  }),
});
export type RoutineBody = z.infer<typeof routineBodySchema>;

/** Rutina asignada a un cliente. Se edita como un todo. */
export const routineSchema = routineBodySchema.extend({
  ...tenantFields,
  clientId: idSchema,
  status: planStatusSchema,
  /** Nombre de la plantilla de origen, congelado. Es copia, no enlace (§4). */
  sourceTemplateName: z.string().nullable(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});
export type Routine = z.infer<typeof routineSchema>;
