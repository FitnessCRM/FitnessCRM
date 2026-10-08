import { describe, expect, it } from "vitest";
import {
  FoodCatalogUnavailableError,
  catalogFoodInputSchema,
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
    // Todas se leen salvo la errata sembrada, que redondeada pasa de 100 g.
    const unreadable = state.catalogFoods.filter(
      ({ food }) => !catalogFoodInputSchema.strict().safeParse(food).success,
    );
    expect(unreadable.map(({ food }) => food.id)).toEqual(["off-mezcla-frutos-secos"]);
  });

  it("has seeded foods from both sources, without an author and with two-decimal macros", () => {
    const { state } = ports();
    const seeded = state.catalogFoods.filter(({ food }) => food.source !== "trainer");
    expect(new Set(seeded.map(({ food }) => food.source))).toEqual(new Set(["usda", "off"]));
    expect(seeded.every(({ authorId }) => authorId === null)).toBe(true);
    expect(seeded.some(({ food }) => !catalogFoodSchema.safeParse(food).success)).toBe(true);
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
  type Ports = ReturnType<typeof ports>;
  const search = async (p: Ports, text: string, limit?: number) =>
    (await p.foodCatalog.searchCatalogFoods({ text, limit })).foods;

  /** Recorre la búsqueda entera siguiendo el cursor. Solo en las pruebas: el código pide de una en una. */
  async function allPages(p: Ports, text: string, limit: number) {
    const pages: { ids: string[]; nextCursor: string | null }[] = [];
    let cursor: string | null = null;
    do {
      const page = await p.foodCatalog.searchCatalogFoods({ text, cursor, limit });
      pages.push({ ids: page.foods.map((f) => f.id), nextCursor: page.nextCursor });
      cursor = page.nextCursor;
    } while (cursor !== null && pages.length < 50);
    return pages;
  }

  /** Mete en el catálogo un alimento activo, como lo serviría la API. */
  function addToCatalog(p: Ports, id: string, name: string, source: "trainer" | "usda" | "off") {
    p.state.catalogFoods.push({
      authorId: source === "trainer" ? OTHER_TRAINER_ID : null,
      food: {
        id,
        name,
        composition: { kcal: 100, proteinG: 1, carbsG: 1, fatG: 1 },
        status: "activo",
        source,
      },
    });
  }

  it("never says who wrote a food: no author, only its source", async () => {
    const p = ports();
    expect(await allPages(p, "", 100)).toHaveLength(1);
    const catalog = await search(p, "", 100);
    expect(catalog.length).toBeGreaterThan(10);
    for (const food of catalog) {
      expect(Object.keys(food).sort()).toEqual(["composition", "id", "name", "source", "status"]);
      expect(food.status).toBe("activo");
    }
    expect(JSON.stringify(catalog)).not.toContain(OTHER_TRAINER_ID);
    expect(JSON.stringify(catalog)).not.toContain(ADRIAN);
    expect(new Set(catalog.map((f) => f.source))).toEqual(new Set(["trainer", "usda", "off"]));
  });

  it("ignores case and accents", async () => {
    const p = ports();
    expect((await search(p, "PLATANO")).map((f) => f.name)).toEqual(["Plátano crudo", "Plátano"]);
    expect((await search(p, "atún")).map((f) => f.name)).toEqual(["Atún al natural"]);
    expect((await search(p, "atun")).map((f) => f.name)).toEqual(["Atún al natural"]);
  });

  it("orders by starts with, then a word that starts with it, then contains it; seeded first on a tie", async () => {
    const p = ports();
    addToCatalog(p, "t-avena-hojuelas", "Avena en hojuelas", "trainer");
    addToCatalog(p, "off-avena-instantanea", "Avena instantánea", "off");
    addToCatalog(p, "t-maxiavena", "Copos maxiavena", "trainer");
    expect((await search(p, "avena", 100)).map((f) => f.name)).toEqual([
      "Avena instantánea",
      "Avena en hojuelas",
      "Bebida de avena",
      "Copos de avena",
      "Copos maxiavena",
    ]);
  });

  it("with fewer than 3 letters, does not match inside a word", async () => {
    const p = ports();
    addToCatalog(p, "t-maxiavena", "Copos maxiavena", "trainer");
    expect((await search(p, "av", 100)).map((f) => f.name)).not.toContain("Copos maxiavena");
    expect((await search(p, "ave", 100)).map((f) => f.name)).toContain("Copos maxiavena");
  });

  it("with an empty text, lists them all by name, seeded or not", async () => {
    const p = ports();
    const names = (await search(p, "", 100)).map((f) => f.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("without a cursor, never returns more than the limit: 10 by default", async () => {
    const p = ports();
    expect(await search(p, "")).toHaveLength(10);
    for (const limit of [1, 3, 5]) {
      expect(await search(p, "", limit)).toHaveLength(limit);
    }
    for (const text of ["", "a", "de", "arroz"]) {
      for (const limit of [1, 2, 10, 100]) {
        expect((await search(p, text, limit)).length).toBeLessThanOrEqual(limit);
      }
    }
  });

  it("rejects a limit below 1, above 100 or with decimals", async () => {
    const p = ports();
    for (const limit of [0, 101, 2.5]) {
      await expect(p.foodCatalog.searchCatalogFoods({ text: "", limit })).rejects.toThrow();
    }
  });

  it("pages with an opaque cursor down to the last page, without repeating or skipping anything", async () => {
    const p = ports();
    const everything = (await search(p, "", 100)).map((f) => f.id);
    const pages = await allPages(p, "", 4);
    expect(pages.length).toBeGreaterThan(2);
    expect(pages.at(-1)!.nextCursor).toBeNull();
    expect(pages.slice(0, -1).every((page) => typeof page.nextCursor === "string")).toBe(true);
    expect(pages.every((page) => page.ids.length <= 4)).toBe(true);
    expect(pages.flatMap((page) => page.ids)).toEqual(everything);
  });

  it("rejects a cursor it did not issue", async () => {
    const p = ports();
    for (const cursor of ["garbage!", btoa("-4"), btoa("1.5"), btoa("04")]) {
      await expect(p.foodCatalog.searchCatalogFoods({ text: "", cursor })).rejects.toMatchObject({
        code: "food_catalog.invalid_cursor",
      });
    }
  });

  it("leaves archived foods out", async () => {
    const p = ports();
    const archived = p.state.catalogFoods.filter((e) => e.food.status === "archivado");
    expect(archived.length).toBeGreaterThan(0);
    const ids = (await allPages(p, "", 3)).flatMap((page) => page.ids);
    for (const entry of archived) {
      expect(ids).not.toContain(entry.food.id);
      expect(await search(p, entry.food.name)).toEqual([]);
    }
  });

  it("rounds a seeded food's macros to one decimal", async () => {
    const p = ports();
    const [egg] = await search(p, "huevo");
    expect(egg).toMatchObject({
      source: "usda",
      composition: { kcal: 143, proteinG: 12.6, carbsG: 0.7, fatG: 9.5 },
    });
  });

  it("does not offer a food that goes over 100 g once rounded, and the page still answers", async () => {
    const p = ports();
    const entry = p.state.catalogFoods.find((e) => e.food.id === "off-mezcla-frutos-secos")!;
    expect(entry.food.status).toBe("activo");
    const page = await p.foodCatalog.searchCatalogFoods({ text: "mezcla de frutos secos" });
    expect(page).toEqual({ foods: [], nextCursor: null });
    const ids = (await allPages(p, "", 3)).flatMap((page) => page.ids);
    expect(ids).not.toContain(entry.food.id);
    expect(ids.length).toBeGreaterThan(10);
  });

  it("publishes a food of its author, archived included, which then stops being served", async () => {
    const p = ports();
    const created = await p.ownFoods.createFood(ADRIAN, draft);
    await p.foodCatalog.publishFood(ADRIAN, created);
    expect((await search(p, draft.name)).map((f) => f.id)).toContain(created.id);

    const archived = await p.ownFoods.archiveFood(ADRIAN, created.id);
    await p.foodCatalog.publishFood(ADRIAN, archived);
    expect((await search(p, draft.name)).map((f) => f.id)).not.toContain(created.id);
  });

  it("gives not_found when someone publishes a food that is not theirs (I28), seeded included", async () => {
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
    const seeded = { ...mine!, id: "usda-huevo", name: "Cambiado" };
    await expect(p.foodCatalog.publishFood(ADRIAN, seeded)).rejects.toMatchObject({
      code: "not_found",
    });
    expect(p.state.catalogFoods.find((e) => e.food.id === othersFood.id)!.food.name).toBe(
      othersFood.name,
    );
  });

  it("when it is down it throws food_catalog.unavailable, and the own copy keeps answering", async () => {
    const p = ports({ foodCatalogDown: true });
    await expect(p.foodCatalog.searchCatalogFoods({ text: "" })).rejects.toBeInstanceOf(
      FoodCatalogUnavailableError,
    );
    await expect(p.foodCatalog.searchCatalogFoods({ text: "avena" })).rejects.toMatchObject({
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
