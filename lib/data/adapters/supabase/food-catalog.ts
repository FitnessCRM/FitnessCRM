import type { FoodCatalogPort } from "@/lib/data/ports";
import { FoodCatalogUnavailableError } from "@/lib/domain";

/**
 * El catálogo común de alimentos con Supabase, hasta que exista su API (tarjeta 90, §12): no vive en
 * la base y responde siempre «no disponible». La copia propia de cada entrenador sigue funcionando.
 */
export function createUnavailableFoodCatalogPort(): FoodCatalogPort {
  const unavailable = async (): Promise<never> => {
    throw new FoodCatalogUnavailableError();
  };
  return {
    searchCatalogFoods: unavailable,
    publishFood: unavailable,
  };
}
