import type { WeightLog } from "@/lib/domain";

export type WeightLogInput = Omit<WeightLog, "id" | "createdAt">;

export interface WeightLogPort {
  /** Pesajes de un cliente ordenados por fecha ascendente. */
  listWeightLogs(trainerId: string, clientId: string): Promise<WeightLog[]>;
  addWeightLog(input: WeightLogInput): Promise<WeightLog>;
  deleteWeightLog(trainerId: string, weightLogId: string): Promise<void>;
}
