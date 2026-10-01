import type { WorkoutLog } from "@/lib/domain";

export type WorkoutLogInput = Omit<WorkoutLog, "id" | "createdAt">;

export interface WorkoutLogPort {
  /**
   * Todos los registros del cliente, de cualquier versión de su rutina. «Última vez» casa cada
   * serie con su línea prescrita por `routineDayExerciseId`, que se conserva entre versiones (§7).
   */
  listWorkoutLogs(trainerId: string, clientId: string): Promise<WorkoutLog[]>;
  /** Guarda o sustituye la serie (misma prescripción, fecha y número de serie). */
  saveWorkoutLog(input: WorkoutLogInput): Promise<WorkoutLog>;
  /** Deshace una serie registrada. El registro es opcional: tiene que poder retirarse. */
  deleteWorkoutLog(trainerId: string, workoutLogId: string): Promise<void>;
}
