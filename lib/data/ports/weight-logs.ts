import type { WeightLog } from "@/lib/domain";

export type WeightLogInput = Omit<WeightLog, "id" | "createdAt">;

export interface WeightLogPort {
  /** Pesajes de un cliente ordenados por fecha ascendente. */
  listWeightLogs(trainerId: string, clientId: string): Promise<WeightLog[]>;
  /**
   * Registra el peso de una fecha (I23): si el cliente ya tiene pesaje ese día, lo actualiza
   * conservando su `id` y `createdAt`; una nota vacía conserva la anterior.
   */
  saveWeightLog(input: WeightLogInput): Promise<WeightLog>;
  deleteWeightLog(trainerId: string, weightLogId: string): Promise<void>;
}
