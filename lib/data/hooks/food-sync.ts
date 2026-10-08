import type { DataPorts } from "@/lib/data/ports";
import { DomainError, FoodCatalogUnavailableError, type Food, type FoodDraft } from "@/lib/domain";

/**
 * Sincronización de la copia propia de los alimentos con el catálogo común (§4, §7, §12). Vive aquí
 * una sola vez, fuera de React para poder probarla sin componentes: ningún adaptador conoce al otro
 * puerto, y los hooks de `use-foods.ts` solo envuelven estas funciones.
 *
 * La regla es siempre la misma: se escribe en la copia propia, que es la fuente de verdad, y después
 * se intenta publicar. Publicar nunca hace fallar una escritura: si no sale, el alimento se queda
 * `pendiente` y lo reintenta `retryPendingFoods`.
 */
export type FoodPorts = Pick<DataPorts, "ownFoods" | "foodCatalog">;

/** El catálogo común no responde: un estado esperado, no un error que enseñar (§12). */
export function isFoodCatalogUnavailable(error: unknown): boolean {
  return error instanceof DomainError && error.code === FoodCatalogUnavailableError.code;
}

/**
 * La copia propia tal como la necesita la unión con el catálogo (§4): los activos y, además, los
 * archivados que aún están `pendiente`. Esos el catálogo todavía los sirve como activos, y si no
 * estuvieran aquí la unión los daría por «de otro» en vez de esconderlos. `mergeFoodLibrary` deja
 * fuera los archivados. Los archivados ya publicados no hacen falta: el catálogo tampoco los sirve.
 */
export async function listOwnFoodsForLibrary(ports: FoodPorts, trainerId: string): Promise<Food[]> {
  const [active, pending] = await Promise.all([
    ports.ownFoods.listFoods(trainerId),
    ports.ownFoods.listPendingFoods(trainerId),
  ]);
  const activeIds = new Set(active.map((f) => f.id));
  return [...active, ...pending.filter((f) => !activeIds.has(f.id))];
}

/** Lo que deja una escritura: el alimento como quedó y si llegó al catálogo. */
export interface FoodWriteResult {
  food: Food;
  published: boolean;
}

/**
 * Publica esa versión del alimento y, si sale, marca como publicada **esa** versión, no la que haya
 * ahora: si otra escritura entró mientras tanto, la marca no surte efecto y el alimento sigue
 * `pendiente` (§7). Nunca lanza: si publicar o marcar falla, devuelve `published: false` y el
 * alimento tal como estaba.
 */
export async function publishFoodVersion(
  ports: FoodPorts,
  trainerId: string,
  food: Food,
): Promise<FoodWriteResult> {
  try {
    await ports.foodCatalog.publishFood(trainerId, food);
  } catch {
    return { food, published: false };
  }
  try {
    return {
      food: await ports.ownFoods.markFoodPublished(trainerId, food.id, food.updatedAt),
      published: true,
    };
  } catch {
    // Publicado pero sin marcar: sigue `pendiente` y el reintento lo vuelve a publicar, que es
    // idempotente porque publica la versión entera.
    return { food, published: true };
  }
}

/** Crear (sin `foodId`) o editar un alimento propio, y después intentar publicarlo. */
export async function saveFood(
  ports: FoodPorts,
  trainerId: string,
  input: { foodId?: string; draft: FoodDraft },
): Promise<FoodWriteResult> {
  const food = input.foodId
    ? await ports.ownFoods.updateFood(trainerId, input.foodId, input.draft)
    : await ports.ownFoods.createFood(trainerId, input.draft);
  return publishFoodVersion(ports, trainerId, food);
}

/** «Eliminar» (I13): archiva en la copia propia y publica el archivado, que deja de servirse. */
export async function archiveFood(
  ports: FoodPorts,
  trainerId: string,
  foodId: string,
): Promise<FoodWriteResult> {
  const food = await ports.ownFoods.archiveFood(trainerId, foodId);
  if (food.publishStatus === "publicado") return { food, published: false };
  return publishFoodVersion(ports, trainerId, food);
}

export interface RetryPendingResult {
  /** Cuántos llegaron al catálogo en este reintento. */
  published: number;
  /** Cuántos siguen `pendiente`. */
  pending: number;
  /** El catálogo no respondió: se dejó de intentar en el primero. */
  catalogUnavailable: boolean;
}

/**
 * Publica lo pendiente de un entrenador, de uno en uno. Si el catálogo no responde, para en el
 * primero: con Firebase el catálogo responde siempre «no disponible» y cada reintento tiene que
 * costar una sola llamada fallida, no una por alimento. Cualquier otro fallo es de ese alimento y
 * se sigue con el siguiente. Sin pendientes, no llama al catálogo.
 */
export async function retryPendingFoods(
  ports: FoodPorts,
  trainerId: string,
): Promise<RetryPendingResult> {
  const pending = await ports.ownFoods.listPendingFoods(trainerId);
  let published = 0;
  for (const food of pending) {
    try {
      await ports.foodCatalog.publishFood(trainerId, food);
    } catch (error) {
      if (isFoodCatalogUnavailable(error)) {
        return { published, pending: pending.length - published, catalogUnavailable: true };
      }
      continue;
    }
    published++;
    try {
      await ports.ownFoods.markFoodPublished(trainerId, food.id, food.updatedAt);
    } catch {
      // Publicado sin marcar: el próximo reintento lo vuelve a publicar.
    }
  }
  return { published, pending: pending.length - published, catalogUnavailable: false };
}

const inFlight = new WeakMap<FoodPorts, Map<string, Promise<RetryPendingResult>>>();

/**
 * `retryPendingFoods` sin dos a la vez: si ya hay un reintento en marcha para esos puertos y ese
 * entrenador, devuelve el mismo en vez de lanzar otro.
 */
export function retryPendingFoodsOnce(
  ports: FoodPorts,
  trainerId: string,
): Promise<RetryPendingResult> {
  let running = inFlight.get(ports);
  if (!running) inFlight.set(ports, (running = new Map()));
  const current = running.get(trainerId);
  if (current) return current;
  const retry = retryPendingFoods(ports, trainerId).finally(() => running.delete(trainerId));
  running.set(trainerId, retry);
  return retry;
}
