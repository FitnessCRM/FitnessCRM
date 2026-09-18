import type { Trainer } from "@/lib/domain";

export interface TrainerPort {
  getTrainer(trainerId: string): Promise<Trainer | null>;
  updateTrainer(
    trainerId: string,
    changes: Partial<Pick<Trainer, "name" | "timeZone">>,
  ): Promise<Trainer>;
}
