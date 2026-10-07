import type { FoodCatalogPort } from "@/lib/data/ports";
import { FoodCatalogUnavailableError } from "@/lib/domain";

/**
 * El catálogo común de alimentos con Firebase, hasta que exista su API (tarjeta 90, §12): no vive
 * en Firestore y responde siempre «no disponible». Cada entrenador ve solo sus alimentos y todos
 * se quedan `pendiente` de publicar. No importa el SDK: no habla con nadie.
 */
export function createUnavailableFoodCatalogPort(): FoodCatalogPort {
  const unavailable = async (): Promise<never> => {
    throw new FoodCatalogUnavailableError();
  };
  return {
    listCatalogFoods: unavailable,
    publishFood: unavailable,
  };
}
