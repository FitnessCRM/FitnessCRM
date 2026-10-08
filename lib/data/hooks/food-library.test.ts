import { describe, expect, it, vi } from "vitest";
import { createDemoState, createMockPorts } from "@/lib/data/adapters/mock";
import {
  DomainError,
  FoodCatalogInvalidCursorError,
  FoodCatalogUnavailableError,
  type CatalogFood,
  type Food,
  type FoodSearchPage,
} from "@/lib/domain";
import {
  buildFoodLibrary,
  catalogPagesFoods,
  foodCatalogStatus,
  isFoodCatalogInvalidCursor,
  nextCatalogCursor,
  shouldRetryCatalogSearch,
} from "./food-library";
import { listOwnFoodsForLibrary, saveFood } from "./food-sync";

const TODAY = "2026-08-29";
const TRAINER = "t-adrian";

function catalogFood(id: string, name: string, source: CatalogFood["source"]): CatalogFood {
  return {
    id,
    name,
    composition: { kcal: 100, proteinG: 1, carbsG: 1, fatG: 1 },
    status: "activo",
    source,
  };
}

function page(foods: CatalogFood[], nextCursor: string | null = null): FoodSearchPage {
  return { foods, nextCursor };
}

describe("the next catalog page", () => {
  it("comes from nextCursor, not from the page size: a short page can have more", () => {
    expect(nextCatalogCursor(page([], "Mg=="))).toBe("Mg==");
    expect(nextCatalogCursor(page([catalogFood("a", "A", "usda")], "Mw=="))).toBe("Mw==");
    expect(nextCatalogCursor(page([catalogFood("a", "A", "usda")]))).toBeUndefined();
  });
});

describe("catalogPagesFoods", () => {
  it("joins the loaded pages in order, without repeating a food served twice", () => {
    const a = catalogFood("a", "Arroz", "trainer");
    const b = catalogFood("b", "Avena", "usda");
    const c = catalogFood("c", "Atún", "off");
    expect(catalogPagesFoods([page([a, b], "x"), page([b, c])]).map((f) => f.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("buildFoodLibrary", () => {
  it("joins one page of the search with the own copy filtered by the text, all three origins", async () => {
    const ports = createMockPorts({ today: TODAY });
    const own = await listOwnFoodsForLibrary(ports, TRAINER);
    const search = vi.spyOn(ports.foodCatalog, "searchCatalogFoods");
    const first = await ports.foodCatalog.searchCatalogFoods({ text: "arroz", limit: 2 });
    expect(first.nextCursor).not.toBeNull();

    const library = buildFoodLibrary(own, [first], "arroz");
    expect(search).toHaveBeenCalledTimes(1);
    // El arroz basmati es propio y está publicado: sale como tuyo y no se repite como de otro.
    expect(library.map((f) => [f.name, f.origin])).toEqual([
      ["Arroz basmati (en seco)", "own"],
      ["Arroz blanco cocido", "seeded"],
    ]);
  });

  it("does not repeat what is already in the own copy, even renamed and not yet published", async () => {
    const state = createDemoState(TODAY);
    const down = createMockPorts({ state, today: TODAY, foodCatalogDown: true });
    const up = createMockPorts({ state, today: TODAY });
    // Merluza: corregida ayer y aún sin publicar. Se renombra con el catálogo caído.
    await saveFood(down, TRAINER, {
      foodId: "food-merluza",
      draft: {
        name: "Merluza del Cantábrico",
        composition: { kcal: 71, proteinG: 15.9, carbsG: 0, fatG: 0.9 },
      },
    });
    const own = await listOwnFoodsForLibrary(up, TRAINER);
    const pageWithStale = await up.foodCatalog.searchCatalogFoods({ text: "merluza" });
    expect(pageWithStale.foods.map((f) => f.id)).toContain("food-merluza");

    const library = buildFoodLibrary(own, [pageWithStale], "merluza");
    expect(library.filter((f) => f.id === "food-merluza")).toEqual([
      expect.objectContaining({ origin: "own", name: "Merluza del Cantábrico" }),
    ]);
  });

  it("marks someone else's food as other and a seeded one with its source", () => {
    const library = buildFoodLibrary(
      [],
      [page([catalogFood("t1", "Yogur", "trainer"), catalogFood("o1", "Yogur natural", "off")])],
      "yogur",
    );
    expect(library.map((f) => f.origin)).toEqual(["other", "seeded"]);
    expect(library[1]).toMatchObject({ origin: "seeded", source: "off" });
  });

  it("without pages, gives only the own foods that match the text", () => {
    const own = [
      { id: "f1", name: "Plátano", status: "activo" },
      { id: "f2", name: "Nueces", status: "activo" },
    ] as Food[];
    expect(buildFoodLibrary(own, [], "platano").map((f) => f.id)).toEqual(["f1"]);
    expect(buildFoodLibrary(own, [], "").map((f) => f.id)).toEqual(["f1", "f2"]);
  });
});

describe("foodCatalogStatus", () => {
  const invalidCursor = new FoodCatalogInvalidCursorError("Zm9v");
  const unavailable = new FoodCatalogUnavailableError();

  it("is null with «only mine», whatever the search holds", () => {
    expect(foodCatalogStatus({ enabled: false, hasPages: true, error: unavailable })).toBeNull();
  });

  it("is loading until the first page arrives, and available once it has", () => {
    expect(foodCatalogStatus({ enabled: true, hasPages: false, error: null })).toBe("loading");
    expect(foodCatalogStatus({ enabled: true, hasPages: true, error: null })).toBe("available");
  });

  it("is unavailable only when the catalog did not answer", () => {
    expect(foodCatalogStatus({ enabled: true, hasPages: false, error: unavailable })).toBe(
      "unavailable",
    );
    expect(
      foodCatalogStatus({ enabled: true, hasPages: false, error: new DomainError("x", "x") }),
    ).toBe("error");
    expect(foodCatalogStatus({ enabled: true, hasPages: false, error: invalidCursor })).toBe(
      "error",
    );
  });

  it("stays available when «see more» fails, invalid cursor or catalog down: what arrived still counts", () => {
    for (const error of [invalidCursor, unavailable]) {
      expect(foodCatalogStatus({ enabled: true, hasPages: true, error })).toBe("available");
    }
  });
});

describe("retrying a catalog search", () => {
  it("retries neither an unavailable catalog nor an invalid cursor, and anything else once", async () => {
    const ports = createMockPorts({ today: TODAY });
    const error = await ports.foodCatalog
      .searchCatalogFoods({ text: "", cursor: "not-a-cursor" })
      .catch((e: unknown) => e);
    expect(isFoodCatalogInvalidCursor(error)).toBe(true);
    expect(shouldRetryCatalogSearch(0, error)).toBe(false);
    expect(shouldRetryCatalogSearch(0, new FoodCatalogUnavailableError())).toBe(false);
    expect(shouldRetryCatalogSearch(0, new Error("network"))).toBe(true);
    expect(shouldRetryCatalogSearch(1, new Error("network"))).toBe(false);
  });
});
