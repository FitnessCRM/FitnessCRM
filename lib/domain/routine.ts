import { DomainError } from "./errors";
import type { Exercise, Routine, RoutineBody, RoutineTemplate } from "./schemas";

/**
 * I3: una rutina (de cliente o plantilla) solo prescribe ejercicios de la biblioteca de su mismo
 * entrenador. `library` es la biblioteca de ese entrenador; un ejercicio archivado ya no está en
 * ella (§7), así que tampoco vale.
 */
export function assertExercisesInLibrary(
  body: Pick<RoutineBody, "days">,
  library: readonly Pick<Exercise, "id" | "status">[],
): void {
  const available = new Set(library.filter((e) => e.status === "activo").map((e) => e.id));
  const missing = body.days
    .flatMap((d) => d.exercises.map((e) => e.exerciseId))
    .filter((id) => !available.has(id));
  if (missing.length > 0) {
    throw new DomainError(
      "routine.exercise_not_in_library",
      `Ejercicios fuera de la biblioteca del entrenador (I3): ${[...new Set(missing)].join(", ")}`,
    );
  }
}

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
