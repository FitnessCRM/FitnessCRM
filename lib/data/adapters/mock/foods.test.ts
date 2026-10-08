import { describe, expect, it } from "vitest";
import {
  FoodCatalogUnavailableError,
  catalogFoodSchema,
  foodSchema,
  type FoodDraft,
} from "@/lib/domain";
import { OTHER_TRAINER_ID } from "./demo-data/foods";
import { createMockPorts } from "./index";

const ADRIAN = "t-adrian";
const TODAY = "2026-08-29";

/** Un reloj que avanza un segundo en cada llamada: cada escritura es una versión distinta. */
function ticking() {
  let n = 0;
  return () => new Date(Date.UTC(2026, 7, 29, 10, 0, n++)).toISOString();
}
const ports = (options: { foodCatalogDown?: boolean } = {}) =>
  createMockPorts({ today: TODAY, now: ticking(), ...options });

const draft: FoodDraft = {
  name: "Lentejas cocidas",
  composition: { kcal: 116, proteinG: 9, carbsG: 20.1, fatG: 0.4 },
};

describe("food demo data", () => {
  it("validates, and the catalog entries carry nothing of their author", () => {
    const { state } = ports();
    state.foods.forEach((f) => foodSchema.parse(f));
    state.catalogFoods.forEach(({ food }) => {
      expect(catalogFoodSchema.strict().safeParse(food).success).toBe(true);
    });
  });

  it("has an own food pending, another trainer's foods only in the catalog, and a menu and a template mixing library and free text", () => {
    const { state } = ports();
    expect(state.foods.some((f) => f.trainerId === ADRIAN && f.publishStatus === "pendiente")).toBe(
      true,
    );
    expect(state.foods.some((f) => f.trainerId === OTHER_TRAINER_ID)).toBe(false);
    expect(state.catalogFoods.some((e) => e.authorId === OTHER_TRAINER_ID)).toBe(true);

    const mixes = (meals: { items: { foodId?: string }[] }[]) => {
      const items = meals.flatMap((m) => m.items);
      return items.some((i) => i.foodId) && items.some((i) => !i.foodId);
    };
    expect(state.menus.some((m) => mixes(m.meals))).toBe(true);
    expect(state.menuTemplates.some((t) => t.menus.some((m) => mixes(m.meals)))).toBe(true);
  });
});

describe("OwnFoodPort (in memory)", () => {
  it("lists only the trainer's active foods; another trainer sees none of them", async () => {
    const p = ports();
    const mine = await p.ownFoods.listFoods(ADRIAN);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((f) => f.trainerId === ADRIAN && f.status === "activo")).toBe(true);
    expect(await p.ownFoods.listFoods(OTHER_TRAINER_ID)).toEqual([]);
    expect(await p.ownFoods.getFood(OTHER_TRAINER_ID, mine[0]!.id)).toBeNull();
  });

  it("create, edit and archive leave the food pending; an archived one is still pending to publish", async () => {
    const p = ports();
    const created = await p.ownFoods.createFood(ADRIAN, draft);
    expect(created).toMatchObject({
      trainerId: ADRIAN,
      status: "activo",
      publishStatus: "pendiente",
    });

    await p.ownFoods.markFoodPublished(ADRIAN, created.id, created.updatedAt);
    const edited = await p.ownFoods.updateFood(ADRIAN, created.id, { ...draft, name: "Lentejas" });
    expect(edited.publishStatus).toBe("pendiente");

    await p.ownFoods.markFoodPublished(ADRIAN, created.id, edited.updatedAt);
    const archived = await p.ownFoods.archiveFood(ADRIAN, created.id);
    expect(archived).toMatchObject({ status: "archivado", publishStatus: "pendiente" });
    expect((await p.ownFoods.listFoods(ADRIAN)).some((f) => f.id === created.id)).toBe(false);
    expect((await p.ownFoods.listPendingFoods(ADRIAN)).map((f) => f.id)).toContain(created.id);
  });

  it("rounds the macros the trainer typed, through the domain", async () => {
    const p = ports();
    const created = await p.ownFoods.createFood(ADRIAN, {
      ...draft,
      composition: { ...draft.composition, proteinG: 3.55 },
    });
    expect(created.composition.proteinG).toBe(3.6);
  });

  it("marks as published only the version that was published, not a later write", async () => {
    const p = ports();
    const v1 = await p.ownFoods.createFood(ADRIAN, draft);
    const v2 = await p.ownFoods.updateFood(ADRIAN, v1.id, { ...draft, name: "Lentejas pardinas" });

    const stale = await p.ownFoods.markFoodPublished(ADRIAN, v1.id, v1.updatedAt);
    expect(stale.publishStatus).toBe("pendiente");
    const current = await p.ownFoods.markFoodPublished(ADRIAN, v1.id, v2.updatedAt);
    expect(current.publishStatus).toBe("publicado");
  });

  it("gives not_found for every write on someone else's food", async () => {
    const p = ports();
    const [food] = await p.ownFoods.listFoods(ADRIAN);
    const id = food!.id;
    await expect(p.ownFoods.updateFood(OTHER_TRAINER_ID, id, draft)).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(p.ownFoods.archiveFood(OTHER_TRAINER_ID, id)).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(
      p.ownFoods.markFoodPublished(OTHER_TRAINER_ID, id, food!.updatedAt),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(await p.ownFoods.getFood(ADRIAN, id)).toEqual(food);
  });

  it("keeps the trainer and the id whatever the draft brings", async () => {
    const p = ports();
    const [food] = await p.ownFoods.listFoods(ADRIAN);
    const edited = await p.ownFoods.updateFood(ADRIAN, food!.id, {
      ...draft,
      id: "otro",
      trainerId: OTHER_TRAINER_ID,
    } as FoodDraft);
    expect(edited).toMatchObject({ id: food!.id, trainerId: ADRIAN });
  });
});

describe("FoodCatalogPort (in memory)", () => {
  it("lists the active foods of every trainer and never says who wrote them", async () => {
    const p = ports();
    const catalog = await p.foodCatalog.listCatalogFoods();
    expect(catalog.length).toBeGreaterThan(0);
    for (const food of catalog) {
      expect(Object.keys(food).sort()).toEqual(["composition", "id", "name", "status"]);
      expect(food.status).toBe("activo");
    }
    expect(JSON.stringify(catalog)).not.toContain(OTHER_TRAINER_ID);
    expect(JSON.stringify(catalog)).not.toContain(ADRIAN);
  });

  it("publishes a food of its author, archived included, which then stops being served", async () => {
    const p = ports();
    const created = await p.ownFoods.createFood(ADRIAN, draft);
    await p.foodCatalog.publishFood(ADRIAN, created);
    expect((await p.foodCatalog.listCatalogFoods()).map((f) => f.id)).toContain(created.id);

    const archived = await p.ownFoods.archiveFood(ADRIAN, created.id);
    await p.foodCatalog.publishFood(ADRIAN, archived);
    expect((await p.foodCatalog.listCatalogFoods()).map((f) => f.id)).not.toContain(created.id);
  });

  it("gives not_found when someone publishes a food that is not theirs (I28)", async () => {
    const p = ports();
    const othersFood = p.state.catalogFoods.find((e) => e.authorId === OTHER_TRAINER_ID)!.food;
    const [mine] = await p.ownFoods.listFoods(ADRIAN);
    const forged = { ...mine!, id: othersFood.id, name: "Cambiado" };
    await expect(p.foodCatalog.publishFood(ADRIAN, forged)).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(p.foodCatalog.publishFood(OTHER_TRAINER_ID, mine!)).rejects.toMatchObject({
      code: "not_found",
    });
    expect(p.state.catalogFoods.find((e) => e.food.id === othersFood.id)!.food.name).toBe(
      othersFood.name,
    );
  });

  it("when it is down it throws food_catalog.unavailable, and the own copy keeps answering", async () => {
    const p = ports({ foodCatalogDown: true });
    await expect(p.foodCatalog.listCatalogFoods()).rejects.toBeInstanceOf(
      FoodCatalogUnavailableError,
    );
    await expect(p.foodCatalog.listCatalogFoods()).rejects.toMatchObject({
      code: "food_catalog.unavailable",
    });

    expect((await p.ownFoods.listFoods(ADRIAN)).length).toBeGreaterThan(0);
    const created = await p.ownFoods.createFood(ADRIAN, draft);
    await expect(p.foodCatalog.publishFood(ADRIAN, created)).rejects.toMatchObject({
      code: "food_catalog.unavailable",
    });
    expect((await p.ownFoods.getFood(ADRIAN, created.id))?.publishStatus).toBe("pendiente");
  });
});
