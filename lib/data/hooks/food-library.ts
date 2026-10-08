import {
  DomainError,
  FoodCatalogInvalidCursorError,
  mergeFoodLibrary,
  type CatalogFood,
  type Food,
  type FoodSearchPage,
  type LibraryFood,
} from "@/lib/domain";
import { isFoodCatalogUnavailable } from "./food-sync";

/**
 * La biblioteca de alimentos a partir de lo que ya está cargado: la copia propia entera y las páginas
 * del catálogo común que se han pedido (§4). Fuera de React para probarla sin componentes; `useFoods`
 * solo la envuelve. Nada de aquí pide páginas: une las que le dan, y la siguiente la pide quien usa el
 * hook («ver más»).
 */

/**
 * Cómo está el catálogo común para esta búsqueda. `null` con «solo los míos»: no se consulta.
 * - `loading`: aún no ha llegado la primera página.
 * - `available`: la lista lleva también lo que llega del catálogo.
 * - `unavailable`: no respondió; la lista lleva solo los propios (§12). No es un error de pantalla.
 * - `error`: la primera página falló por otra cosa; la lista lleva solo los propios.
 */
export type FoodCatalogStatus = "loading" | "available" | "unavailable" | "error" | null;

/** El cursor no lo emitió el catálogo o ya no vale: un error de la búsqueda, no un catálogo caído. */
export function isFoodCatalogInvalidCursor(error: unknown): boolean {
  return error instanceof DomainError && error.code === FoodCatalogInvalidCursorError.code;
}

/**
 * El cursor de la página siguiente, para TanStack Query (`getNextPageParam`). Sale solo de
 * `nextCursor`, nunca del tamaño de la página: el catálogo descarta lo que no se puede leer, así que
 * una página puede traer menos del límite y no ser la última. `undefined` es que no hay más.
 */
export function nextCatalogCursor(lastPage: FoodSearchPage): string | undefined {
  return lastPage.nextCursor ?? undefined;
}

/**
 * Lo que llega del catálogo en las páginas ya cargadas, en orden y sin repetir: el cursor es un
 * desplazamiento, y si el catálogo cambia entre una página y la siguiente puede volver a servir un
 * alimento que ya llegó. Se queda el primero.
 */
export function catalogPagesFoods(pages: readonly FoodSearchPage[]): CatalogFood[] {
  const seen = new Set<string>();
  return pages
    .flatMap((page) => page.foods)
    .filter((food) => {
      if (seen.has(food.id)) return false;
      seen.add(food.id);
      return true;
    });
}

/**
 * La biblioteca para un texto: los propios que coinciden con él y lo que ha llegado del catálogo en
 * las páginas cargadas, sin lo que ya está en la copia propia (`mergeFoodLibrary`). `own` es la copia
 * propia entera, con los archivados pendientes, porque tapa al catálogo aunque no coincida con el
 * texto. Sin páginas (catálogo caído, cargando o «solo los míos»), solo los propios.
 */
export function buildFoodLibrary(
  own: readonly Food[],
  catalogPages: readonly FoodSearchPage[],
  text: string,
): LibraryFood[] {
  return mergeFoodLibrary(own, catalogPagesFoods(catalogPages), text);
}

/**
 * El estado del catálogo según la búsqueda. Lo decide la primera página: si ya hay páginas cargadas,
 * está disponible aunque luego falle «ver más» o una recarga, que no esconden lo que ya llegó (el
 * fallo de «ver más» se da aparte). Sin páginas, un error es `unavailable` solo si el catálogo no
 * respondió; cualquier otro es `error`.
 */
export function foodCatalogStatus(search: {
  enabled: boolean;
  hasPages: boolean;
  error: unknown;
}): FoodCatalogStatus {
  if (!search.enabled) return null;
  if (search.hasPages) return "available";
  if (search.error == null) return "loading";
  return isFoodCatalogUnavailable(search.error) ? "unavailable" : "error";
}

/**
 * Si se reintenta una petición del catálogo: ni «no disponible», para llegar enseguida a los propios
 * solos, ni un cursor inválido, que volvería a fallar igual. Lo demás, una vez.
 */
export function shouldRetryCatalogSearch(failureCount: number, error: unknown): boolean {
  return !isFoodCatalogUnavailable(error) && !isFoodCatalogInvalidCursor(error) && failureCount < 1;
}
