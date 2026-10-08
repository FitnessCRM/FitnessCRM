import type { FoodCatalogPort, OwnFoodPort } from "@/lib/data/ports";
import {
  DomainError,
  FoodCatalogUnavailableError,
  catalogFoodSchema,
  foodDraftSchema,
  foodSchema,
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

export interface MockFoodCatalogOptions {
  /** Simula que el catálogo común no responde: cada llamada lanza `food_catalog.unavailable`. */
  down?: boolean;
}

/**
 * El catálogo común. Guarda quién publicó cada alimento para cumplir I28, pero no lo devuelve nunca:
 * de un alimento ajeno solo se sabe que es «de otro» (§4). No lee la copia propia, igual que la API
 * de verdad no leerá Firestore.
 */
export function createFoodCatalogPort(
  ctx: MockContext,
  options: MockFoodCatalogOptions = {},
): FoodCatalogPort {
  const available = () => {
    if (options.down) throw new FoodCatalogUnavailableError();
  };

  return {
    listCatalogFoods: async () => {
      available();
      return ctx.reply(
        ctx.state.catalogFoods
          .map((entry) => entry.food)
          .filter((f) => f.status === "activo")
          .sort(byName),
      );
    },
    publishFood: async (trainerId, food) => {
      available();
      const existing = ctx.state.catalogFoods.find((entry) => entry.food.id === food.id);
      // Solo el autor publica lo suyo (I28). Lo ajeno da `not_found`, sin decir de quién es.
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
