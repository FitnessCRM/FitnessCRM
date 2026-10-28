import type { OwnFoodPort } from "@/lib/data/ports";
import { foodDraftSchema, type Food } from "@/lib/domain";
import type { SupabaseClient } from "./client";
import { notFoundError, raise } from "./errors";
import { FOOD_COLUMNS, foodFromRow, type FoodRow } from "./catalog-rows";
import { rowsOf } from "./queries";

/** Lo que el entrenador escribe en un alimento: nombre y composición, ya redondeados por el dominio. */
const foodColumns = (draft: { name: string; composition: Food["composition"] }) => ({
  name: draft.name,
  kcal: draft.composition.kcal,
  protein_g: draft.composition.proteinG,
  carbs_g: draft.composition.carbsG,
  fat_g: draft.composition.fatG,
});

/**
 * La copia propia de los alimentos (§4, §12): solo su entrenador la lee y la escribe (I1, I28, por la
 * política de la tabla). Cada escritura deja el alimento `pendiente` de publicar (§7).
 */
export function createOwnFoodPort(client: SupabaseClient): OwnFoodPort {
  /** El alimento del entrenador, o `not_found` si no es suyo. */
  async function readFood(trainerId: string, foodId: string): Promise<Food | null> {
    const { data, error } = await client
      .from("foods")
      .select(FOOD_COLUMNS)
      .eq("trainer_id", trainerId)
      .eq("id", foodId)
      .maybeSingle();
    raise(error);
    return data ? foodFromRow(data as FoodRow) : null;
  }

  async function requireFood(trainerId: string, foodId: string): Promise<Food> {
    const food = await readFood(trainerId, foodId);
    if (!food) throw notFoundError("Alimento");
    return food;
  }

  return {
    listFoods: async (trainerId) =>
      (
        await rowsOf(
          client
            .from("foods")
            .select(FOOD_COLUMNS)
            .eq("trainer_id", trainerId)
            .eq("status", "activo"),
          foodFromRow,
        )
      ).sort((a, b) => a.name.localeCompare(b.name)),

    getFood: readFood,

    createFood: async (trainerId, draft) => {
      const data = foodDraftSchema.parse(draft);
      const { data: row, error } = await client
        .from("foods")
        .insert({
          ...foodColumns(data),
          trainer_id: trainerId,
          status: "activo",
          publish_status: "pendiente",
        })
        .select(FOOD_COLUMNS)
        .single();
      raise(error);
      return foodFromRow(row as FoodRow);
    },

    updateFood: async (trainerId, foodId, draft) => {
      await requireFood(trainerId, foodId);
      const data = foodDraftSchema.parse(draft);
      const { data: row, error } = await client
        .from("foods")
        .update({ ...foodColumns(data), publish_status: "pendiente" })
        .eq("trainer_id", trainerId)
        .eq("id", foodId)
        .select(FOOD_COLUMNS)
        .maybeSingle();
      raise(error);
      if (!row) throw notFoundError("Alimento");
      return foodFromRow(row as FoodRow);
    },

    // La función lo archiva y lo deja `pendiente` en la misma sentencia (migración catalog_writes).
    archiveFood: async (trainerId, foodId) => {
      const { error } = await client.rpc("archive_food", { p_food_id: foodId });
      raise(error);
      return requireFood(trainerId, foodId);
    },

    listPendingFoods: (trainerId) =>
      rowsOf(
        client
          .from("foods")
          .select(FOOD_COLUMNS)
          .eq("trainer_id", trainerId)
          .eq("publish_status", "pendiente"),
        foodFromRow,
      ),

    // Solo surte efecto si `version` sigue siendo la actual (migración catalog_writes). Lo que devuelve
    // es el alimento como queda: `publicado` si la versión era la actual.
    markFoodPublished: async (trainerId, foodId, version) => {
      await requireFood(trainerId, foodId);
      const { error } = await client.rpc("mark_food_published", {
        p_food_id: foodId,
        p_version: version,
      });
      raise(error);
      return requireFood(trainerId, foodId);
    },
  };
}
