import type { Exercise } from "@/lib/domain";

export type ExerciseInput = Omit<Exercise, "id" | "createdAt">;
export type ExerciseChanges = Partial<Omit<ExerciseInput, "trainerId">>;

/** Qué rutinas de cliente prescriben un ejercicio: base del aviso previo al borrado. */
export interface ExerciseUsage {
  clientIds: string[];
  routineTemplateIds: string[];
}

export interface ExercisePort {
  listExercises(trainerId: string): Promise<Exercise[]>;
  getExercise(trainerId: string, exerciseId: string): Promise<Exercise | null>;
  createExercise(input: ExerciseInput): Promise<Exercise>;
  updateExercise(
    trainerId: string,
    exerciseId: string,
    changes: ExerciseChanges,
  ): Promise<Exercise>;
  getExerciseUsage(trainerId: string, exerciseId: string): Promise<ExerciseUsage>;
  /** Borra el ejercicio y lo retira de todas las rutinas y plantillas que lo prescribían. */
  deleteExercise(trainerId: string, exerciseId: string): Promise<void>;
}
