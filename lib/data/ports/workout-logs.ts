import type { WorkoutLog } from "@/lib/domain";

export type WorkoutLogInput = Omit<WorkoutLog, "id" | "createdAt">;

export interface WorkoutLogPort {
  listWorkoutLogs(trainerId: string, clientId: string, routineId: string): Promise<WorkoutLog[]>;
  /** Guarda o sustituye la serie (misma prescripción, fecha y número de serie). */
  saveWorkoutLog(input: WorkoutLogInput): Promise<WorkoutLog>;
  /** Deshace una serie registrada. El registro es opcional: tiene que poder retirarse. */
  deleteWorkoutLog(trainerId: string, workoutLogId: string): Promise<void>;
}
