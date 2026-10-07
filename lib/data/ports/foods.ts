import type { CatalogFood, Food, FoodDraft } from "@/lib/domain";

/**
 * La copia propia de los alimentos de un entrenador (§4): la fuente de verdad, con `trainerId`, que
 * cumple I1 como cualquier otro dato suyo. Crear, editar y archivar dejan el alimento `pendiente` de
 * publicar (§7): publicarlo en el catálogo común no es cosa de este puerto, que no conoce al otro.
 */
export interface OwnFoodPort {
  /** Su biblioteca: solo los activos. */
  listFoods(trainerId: string): Promise<Food[]>;
  /** Cualquiera de los suyos, archivado incluido. */
  getFood(trainerId: string, foodId: string): Promise<Food | null>;
  /** Nace `activo` y `pendiente`. */
  createFood(trainerId: string, draft: FoodDraft): Promise<Food>;
  /** Cambia nombre y composición; vuelve a `pendiente`. Los menús que lo usan no cambian (I29). */
  updateFood(trainerId: string, foodId: string, draft: FoodDraft): Promise<Food>;
  /**
   * «Eliminar» de la UI (I13, §7): pasa a `archivado` y vuelve a `pendiente`, porque el catálogo
   * también tiene que dejar de servirlo. No toca ningún menú (I29). Un archivado no vuelve a `activo`.
   */
  archiveFood(trainerId: string, foodId: string): Promise<Food>;
  /** Lo que falta por publicar, archivados incluidos: lo que hay que reintentar. */
  listPendingFoods(trainerId: string): Promise<Food[]>;
  /**
   * Marca como `publicado` la versión `version` (su `updatedAt`) de un alimento. Solo surte efecto si
   * sigue siendo la actual: una escritura posterior a esa publicación lo deja `pendiente`. Devuelve
   * el alimento como queda.
   */
  markFoodPublished(trainerId: string, foodId: string, version: string): Promise<Food>;
}

/**
 * El catálogo común de alimentos (§4, §12): lo que leen todos los entrenadores. Lo servirá una API
 * propia (tarjeta 90). Cuando no responde, cada método lanza `FoodCatalogUnavailableError`
 * (`food_catalog.unavailable`) y la copia propia sigue funcionando.
 */
export interface FoodCatalogPort {
  /** Los alimentos activos de todos los entrenadores, sin nada de su autor. */
  listCatalogFoods(): Promise<CatalogFood[]>;
  /**
   * Publica la versión actual de un alimento de `trainerId`, archivado incluido (así deja de
   * servirse). Solo el autor escribe lo suyo (I28): con un alimento ajeno, `not_found`.
   */
  publishFood(trainerId: string, food: Food): Promise<void>;
}
