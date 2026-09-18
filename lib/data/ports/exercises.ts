import type { Exercise } from "@/lib/domain";

export type ExerciseInput = Omit<Exercise, "id" | "createdAt">;
export type ExerciseChanges = Partial<Omit<ExerciseInput, "trainerId" | "status">>;

/** Qué rutinas de cliente prescriben un ejercicio: base del aviso previo al archivado. */
export interface ExerciseUsage {
  clientIds: string[];
  routineTemplateIds: string[];
}

export interface ExercisePort {
  /** La biblioteca: solo ejercicios activos. */
  listExercises(trainerId: string): Promise<Exercise[]>;
  /** Cualquier ejercicio, archivado incluido: un WorkoutLog antiguo tiene que poder leerse. */
  getExercise(trainerId: string, exerciseId: string): Promise<Exercise | null>;
  createExercise(input: ExerciseInput): Promise<Exercise>;
  updateExercise(
    trainerId: string,
    exerciseId: string,
    changes: ExerciseChanges,
  ): Promise<Exercise>;
  getExerciseUsage(trainerId: string, exerciseId: string): Promise<ExerciseUsage>;
  /**
   * "Eliminar" de la UI (I13, §7): el ejercicio pasa a `archivado`, sale de la biblioteca y de
   * todas las rutinas y plantillas que lo prescribían. La fila sobrevive.
   */
  archiveExercise(trainerId: string, exerciseId: string): Promise<Exercise>;
}
