import type { Routine, RoutineBody, RoutineTemplate } from "./schemas";

/** Ids de las rutinas (de cliente o plantilla) que prescriben un ejercicio dado. */
export function routinesUsingExercise<T extends RoutineBody & { id: string }>(
  routines: readonly T[],
  exerciseId: string,
): T[] {
  return routines.filter((r) =>
    r.days.some((d) => d.exercises.some((e) => e.exerciseId === exerciseId)),
  );
}

/**
 * Al archivar un ejercicio de la biblioteca, desaparece de las rutinas que lo prescribían.
 * El entrenador ha sido avisado antes de confirmar; los días se conservan aunque queden vacíos.
 */
export function removeExerciseFromRoutine<T extends Routine | RoutineTemplate>(
  routine: T,
  exerciseId: string,
): T {
  return {
    ...routine,
    days: routine.days.map((day) => ({
      ...day,
      exercises: day.exercises.filter((e) => e.exerciseId !== exerciseId),
    })),
  };
}
