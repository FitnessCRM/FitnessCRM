import type { FoodCatalogPort, OwnFoodPort } from "@/lib/data/ports";
import {
  DomainError,
  FoodCatalogUnavailableError,
  catalogFoodSchema,
  foldText,
  foodDraftSchema,
  foodNameMatchRank,
  foodSchema,
  foodSearchSchema,
  parseCatalogFood,
  type CatalogFood,
  type CatalogFoodInput,
  type Food,
} from "@/lib/domain";
import { findOwn, own, replaceById } from "./helpers";
import type { MockContext } from "./store";

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/** La copia propia, filtrada por `trainerId` como el resto (I1, I28). */
export function createOwnFoodPort(ctx: MockContext): OwnFoodPort {
  /** Toda escritura deja el alimento `pendiente`: el catálogo aún no tiene esta versión (§7). */
  const write = (current: Food, changes: Partial<Food>): Food =>
    replaceById(
      ctx.state.foods,
      foodSchema.parse({
        ...current,
        ...changes,
        id: current.id,
        trainerId: current.trainerId,
        publishStatus: "pendiente",
        updatedAt: ctx.now(),
      }),
    );

  return {
    listFoods: async (trainerId) =>
      ctx.reply(
        own(ctx.state.foods, trainerId)
          .filter((f) => f.status === "activo")
          .sort(byName),
      ),
    getFood: async (trainerId, foodId) =>
      ctx.reply(ctx.state.foods.find((f) => f.id === foodId && f.trainerId === trainerId) ?? null),
    createFood: async (trainerId, draft) => {
      const { name, composition } = foodDraftSchema.parse(draft);
      const now = ctx.now();
      const food = foodSchema.parse({
        id: ctx.newId(),
        trainerId,
        name,
        composition,
        status: "activo",
        publishStatus: "pendiente",
        createdAt: now,
        updatedAt: now,
      });
      ctx.state.foods.push(food);
      return ctx.reply(food);
    },
    updateFood: async (trainerId, foodId, draft) => {
      const current = findOwn(ctx.state.foods, trainerId, foodId, "Alimento");
      const { name, composition } = foodDraftSchema.parse(draft);
      return ctx.reply(write(current, { name, composition }));
    },
    archiveFood: async (trainerId, foodId) => {
      const current = findOwn(ctx.state.foods, trainerId, foodId, "Alimento");
      if (current.status === "archivado") return ctx.reply(current);
      return ctx.reply(write(current, { status: "archivado" }));
    },
    listPendingFoods: async (trainerId) =>
      ctx.reply(own(ctx.state.foods, trainerId).filter((f) => f.publishStatus === "pendiente")),
    markFoodPublished: async (trainerId, foodId, version) => {
      const current = findOwn(ctx.state.foods, trainerId, foodId, "Alimento");
      // Una publicación de una versión anterior no marca la actual: sigue pendiente.
      if (current.updatedAt !== version) return ctx.reply(current);
      current.publishStatus = "publicado";
      return ctx.reply(current);
    },
  };
}

/**
 * El cursor es el desplazamiento de la página siguiente en base64, como el de la API: quien llama lo
 * trata como opaco y lo devuelve tal cual. Uno que no salió de aquí es un error, no la primera página.
 */
function encodeCursor(offset: number): string {
  return btoa(String(offset));
}

function decodeCursor(cursor: string | null | undefined): number {
  if (cursor == null) return 0;
  let offset = Number.NaN;
  try {
    offset = Number(atob(cursor));
  } catch {
    // No es base64: cae en el error de abajo.
  }
  if (!Number.isInteger(offset) || offset < 0 || encodeCursor(offset) !== cursor) {
    throw new DomainError("food_catalog.invalid_cursor", `Cursor ${cursor} no válido`);
  }
  return offset;
}

const isSeeded = (food: CatalogFoodInput) => food.source !== "trainer";

/**
 * El orden de la búsqueda del catálogo (contrato `searchFoods` de la API): por relevancia
 * (`foodNameMatchRank`), a igual relevancia los sembrados primero, y luego por nombre. Con el texto
 * vacío, todos por nombre, como dice el contrato; la implementación de la API hoy desempata también
 * ahí por `source` y saca primero los sembrados, una discrepancia anotada en la tarjeta 90 que aquí
 * no se imita. Tampoco se imita lo que la API hace además: encontrar los parecidos (erratas) y
 * desempatar dentro de cada grupo por parecido (`word_similarity`).
 */
function rankCatalog(foods: readonly CatalogFoodInput[], text: string): CatalogFoodInput[] {
  const byNameThenId = (a: CatalogFoodInput, b: CatalogFoodInput) =>
    byName(a, b) || a.id.localeCompare(b.id);
  if (foldText(text) === "") return [...foods].sort(byNameThenId);
  return foods
    .map((food) => ({ food, rank: foodNameMatchRank(food.name, text) }))
    .filter((entry): entry is { food: CatalogFoodInput; rank: 0 | 1 | 2 } => entry.rank !== null)
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        Number(isSeeded(b.food)) - Number(isSeeded(a.food)) ||
        byNameThenId(a.food, b.food),
    )
    .map((entry) => entry.food);
}

export interface MockFoodCatalogOptions {
  /** Simula que el catálogo común no responde: cada llamada lanza `food_catalog.unavailable`. */
  down?: boolean;
}

/**
 * El catálogo común. Guarda quién publicó cada alimento para cumplir I28, pero no lo devuelve nunca:
 * de un alimento ajeno solo se sabe que es «de otro» o, si es sembrado, su fuente (§4). Guarda los
 * alimentos como los sirve la API, sin redondear, y los lee con `parseCatalogFood` igual que hará el
 * adaptador HTTP. No lee la copia propia, igual que la API de verdad no lee Firestore.
 */
export function createFoodCatalogPort(
  ctx: MockContext,
  options: MockFoodCatalogOptions = {},
): FoodCatalogPort {
  const available = () => {
    if (options.down) throw new FoodCatalogUnavailableError();
  };

  return {
    searchCatalogFoods: async (search) => {
      available();
      const { text, cursor, limit } = foodSearchSchema.parse(search);
      const offset = decodeCursor(cursor);
      const ranked = rankCatalog(
        ctx.state.catalogFoods.map((entry) => entry.food).filter((f) => f.status === "activo"),
        text,
      );
      // Aunque lo tenga todo en memoria, una página cada vez: el catálogo no se trae nunca entero.
      const page = ranked.slice(offset, offset + limit);
      const nextOffset = offset + page.length;
      return ctx.reply({
        // Lo que no se puede leer se descarta de la página, sin hacerla fallar (§5).
        foods: page.map(parseCatalogFood).filter((food): food is CatalogFood => food !== null),
        nextCursor: nextOffset < ranked.length ? encodeCursor(nextOffset) : null,
      });
    },
    publishFood: async (trainerId, food) => {
      available();
      const existing = ctx.state.catalogFoods.find((entry) => entry.food.id === food.id);
      // Solo el autor publica lo suyo (I28), y un sembrado no lo publica nadie. Lo ajeno da
      // `not_found`, sin decir de quién es.
      if (food.trainerId !== trainerId || (existing && existing.authorId !== trainerId)) {
        throw new DomainError("not_found", `Alimento ${food.id} no existe`);
      }
      const published = catalogFoodSchema.parse({
        id: food.id,
        name: food.name,
        composition: food.composition,
        status: food.status,
        source: "trainer",
      });
      if (existing) existing.food = published;
      else ctx.state.catalogFoods.push({ authorId: trainerId, food: published });
      await ctx.reply(null);
    },
  };
}
