import type { OwnFoodPort } from "@/lib/data/ports";
import { DomainError } from "@/lib/domain";

/** Provisional: la copia propia sobre Firestore llega en la sección 3 de la tarjeta 88. */
export function createOwnFoodPort(): OwnFoodPort {
  const pending = async (): Promise<never> => {
    throw new DomainError(
      "not_implemented",
      "La copia propia de alimentos aún no está en Firebase",
    );
  };
  return {
    listFoods: pending,
    getFood: pending,
    createFood: pending,
    updateFood: pending,
    archiveFood: pending,
    listPendingFoods: pending,
    markFoodPublished: pending,
  };
}
