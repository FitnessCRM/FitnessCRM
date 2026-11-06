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

/**
 * Saca un ejercicio archivado de las rutinas de clientes (E7, §7). Un borrador se edita en sitio.
 * Una rutina activa no se edita nunca en sitio: se archiva tal cual, con el ejercicio dentro, para
 * que los registros de entreno conserven su prescripción, y la sustituye una versión nueva, activa,
 * sin él, igual que al publicar (mismos ids de días y líneas, para que cada línea conserve su
 * identidad). Las archivadas y las que no lo prescriben no se tocan. Devuelve la lista completa.
 */
export function archiveExerciseInRoutines(
  routines: readonly Routine[],
  exerciseId: string,
  { now, newId }: { now: string; newId: () => string },
): Routine[] {
  const prescribes = (r: Routine) =>
    r.days.some((d) => d.exercises.some((e) => e.exerciseId === exerciseId));
  return routines.flatMap((r) => {
    if (r.status === "archivado" || !prescribes(r)) return [r];
    if (r.status === "borrador")
      return [{ ...removeExerciseFromRoutine(r, exerciseId), updatedAt: now }];
    const archived: Routine = { ...r, status: "archivado", updatedAt: now };
    const version: Routine = {
      ...removeExerciseFromRoutine(r, exerciseId),
      id: newId(),
      status: "activo",
      createdAt: now,
      updatedAt: now,
    };
    return [archived, version];
  });
}
