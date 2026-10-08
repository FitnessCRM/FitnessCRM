import { describe, expect, it } from "vitest";
import { NOW, idFactory } from "./__tests__/fixtures";
import {
  copyFoodItem,
  countNonCountingItems,
  createFoodItem,
  foodItemContribution,
  foodNameMatchRank,
  matchesFoodName,
  mealSubtotal,
  menuRemaining,
  menuTotal,
  mergeFoodLibrary,
  parseCatalogFood,
  renameFoodItem,
  setFoodItemGrams,
} from "./food";
import { emptyMacrosDraft } from "./macros";
import {
  compositionSchema,
  foodDraftSchema,
  foodItemSchema,
  menuSchema,
  roundGrams,
  menuTemplateSchema,
  type CatalogFood,
  type Food,
  type FoodItem,
  type Menu,
  type MenuTemplate,
} from "./schemas";
import { cloneMenuTemplate, duplicateMenuTemplate, menusToTemplateContent } from "./templates";

function food(over: Partial<Food> = {}): Food {
  return {
    id: "food-avena",
    trainerId: "t-adrian",
    name: "Copos de avena",
    composition: { kcal: 372, proteinG: 13.5, carbsG: 58.7, fatG: 7 },
    status: "activo",
    publishStatus: "publicado",
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

function catalogFood(over: Partial<CatalogFood> = {}): CatalogFood {
  return {
    id: "food-arroz",
    name: "Arroz blanco",
    composition: { kcal: 354, proteinG: 7, carbsG: 79, fatG: 0.6 },
    status: "activo",
    source: "trainer",
    ...over,
  };
}

const freeText: FoodItem = { id: "fi-cafe", name: "Café solo", grams: 200 };

describe("compositionSchema", () => {
  const base = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

  it("accepts macros that add up to exactly 100 g, even when floating point says 100.00000000000001", () => {
    expect(0.2 + 83.9 + 15.9).toBe(100.00000000000001);
    expect(
      compositionSchema.safeParse({ ...base, proteinG: 0.2, carbsG: 83.9, fatG: 15.9 }).success,
    ).toBe(true);
    expect(compositionSchema.safeParse({ ...base, proteinG: 100 }).success).toBe(true);
  });

  it("rejects macros that go over 100 g, even by a tenth", () => {
    expect(
      compositionSchema.safeParse({ ...base, proteinG: 33.3, carbsG: 33.4, fatG: 33.4 }).success,
    ).toBe(false);
    expect(compositionSchema.safeParse({ ...base, proteinG: 60, carbsG: 41 }).success).toBe(false);
  });

  it("allows 0 kcal but not decimal or negative kcal", () => {
    expect(compositionSchema.safeParse(base).success).toBe(true);
    expect(compositionSchema.safeParse({ ...base, kcal: 12.5 }).success).toBe(false);
    expect(compositionSchema.safeParse({ ...base, kcal: -1 }).success).toBe(false);
  });

  it("takes macros with one decimal at most, and none below 0", () => {
    expect(compositionSchema.safeParse({ ...base, fatG: 0.3 }).success).toBe(true);
    expect(compositionSchema.safeParse({ ...base, fatG: 12.55 }).success).toBe(false);
    expect(compositionSchema.safeParse({ ...base, fatG: -0.1 }).success).toBe(false);
  });
});

describe("foodDraftSchema: what the trainer types", () => {
  const draft = (
    composition: Partial<{ kcal: number; proteinG: number; carbsG: number; fatG: number }>,
  ) =>
    foodDraftSchema.safeParse({
      name: "Garbanzos cocidos",
      composition: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, ...composition },
    });

  it("rounds macros with more than one decimal to one decimal", () => {
    const parsed = draft({ proteinG: 3.55, carbsG: 12.04, fatG: 0.15 });
    expect(parsed.success && parsed.data.composition).toEqual({
      kcal: 0,
      proteinG: 3.6,
      carbsG: 12,
      fatG: 0.2,
    });
  });

  it("leaves a value with one decimal as it is, and rounding twice changes nothing", () => {
    const once = draft({ proteinG: 12.5, carbsG: 3.55 });
    expect(once.success && once.data.composition).toMatchObject({ proteinG: 12.5, carbsG: 3.6 });
    const twice = once.success && draft(once.data.composition);
    expect(twice && twice.success && twice.data.composition).toEqual(
      once.success && once.data.composition,
    );
    expect(roundGrams(roundGrams(3.55))).toBe(roundGrams(3.55));
  });

  it("checks the 100 g cap on the rounded values", () => {
    expect(33.25 + 33.25 + 33.45).toBeLessThan(100);
    expect(draft({ proteinG: 33.25, carbsG: 33.25, fatG: 33.45 }).success).toBe(false);
    expect(draft({ proteinG: 0.2, carbsG: 83.9, fatG: 15.9 }).success).toBe(true);
  });

  it("does not round kcal: with decimals they are still an error", () => {
    expect(draft({ kcal: 120.4 }).success).toBe(false);
    expect(draft({ kcal: 120 }).success).toBe(true);
  });

  it("keeps rejecting negative macros", () => {
    expect(draft({ fatG: -0.04 }).success).toBe(false);
  });

  it("does not round what is stored: a frozen copy with two decimals is still invalid", () => {
    expect(
      compositionSchema.safeParse({ kcal: 0, proteinG: 3.55, carbsG: 0, fatG: 0 }).success,
    ).toBe(false);
  });
});

describe("foodItemSchema", () => {
  it("still validates a menu written before the food library, untouched", () => {
    const oldMenu: Menu = {
      id: "menu-1",
      trainerId: "t-adrian",
      clientId: "c-marta",
      name: "Menú A",
      dayType: "entrenamiento",
      suggested: true,
      macros: { kcal: 2348, proteinG: 165, carbsG: 260, fatG: 72 },
      meals: [
        { id: "meal-1", name: "Desayuno", items: [{ id: "fi-1", name: "Avena", grams: 80 }] },
      ],
      note: "",
      status: "activo",
      sourceTemplateName: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const parsed = menuSchema.parse(oldMenu);
    expect(parsed).toEqual(oldMenu);
    expect(parsed.meals[0]!.items[0]).not.toHaveProperty("foodId");
  });

  it("needs foodId and composition together, or neither", () => {
    const item = createFoodItem(food(), 80, () => "fi-1");
    expect(foodItemSchema.safeParse(item).success).toBe(true);
    expect(foodItemSchema.safeParse({ ...freeText, foodId: "food-avena" }).success).toBe(false);
    expect(foodItemSchema.safeParse({ ...freeText, composition: food().composition }).success).toBe(
      false,
    );
  });
});

describe("createFoodItem, renameFoodItem and setFoodItemGrams", () => {
  it("freezes the food's name and composition with its grams", () => {
    expect(createFoodItem(food(), 80, () => "fi-1")).toEqual({
      id: "fi-1",
      name: "Copos de avena",
      grams: 80,
      foodId: "food-avena",
      composition: { kcal: 372, proteinG: 13.5, carbsG: 58.7, fatG: 7 },
    });
  });

  it("turns a library item into free text when its name changes", () => {
    const item = createFoodItem(food(), 80, () => "fi-1");
    expect(renameFoodItem(item, "Avena integral")).toEqual({
      id: "fi-1",
      name: "Avena integral",
      grams: 80,
    });
    expect(renameFoodItem(item, "Copos de avena")).toBe(item);
  });

  it("keeps the link when only the grams change", () => {
    const item = createFoodItem(food(), 80, () => "fi-1");
    expect(setFoodItemGrams(item, 60)).toEqual({ ...item, grams: 60 });
  });
});

describe("I29: the frozen copy of a library item", () => {
  it("does not change when the food is corrected or archived afterwards", () => {
    const original = food();
    const item = createFoodItem(original, 80, () => "fi-1");
    original.name = "Avena fina";
    original.composition.proteinG = 99;
    original.status = "archivado";
    expect(item.name).toBe("Copos de avena");
    expect(item.composition).toEqual({ kcal: 372, proteinG: 13.5, carbsG: 58.7, fatG: 7 });
  });

  const template: MenuTemplate = {
    id: "mt-1",
    trainerId: "t-adrian",
    name: "Definición",
    description: "",
    menus: [
      {
        id: "m-1",
        name: "Menú A",
        dayType: "entrenamiento",
        suggested: true,
        macros: { kcal: 2000, proteinG: 150, carbsG: 200, fatG: 60 },
        note: "",
        meals: [
          {
            id: "meal-1",
            name: "Desayuno",
            items: [createFoodItem(food(), 80, () => "fi-1"), freeText],
          },
        ],
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  };
  const frozenItems = (meals: { items: FoodItem[] }[]) =>
    meals[0]!.items.map((item) => ({ ...item, id: "" }));
  const expected = frozenItems(template.menus[0]!.meals);

  it("is copied as is when a template is cloned into a client's plan", () => {
    const [menu] = cloneMenuTemplate(template, {
      trainerId: "t-adrian",
      clientId: "c-marta",
      newId: idFactory("n"),
      now: NOW,
    });
    expect(frozenItems(menu!.meals)).toEqual(expected);
    expect(menuSchema.safeParse(menu).success).toBe(true);
  });

  it("is copied as is when a template is duplicated or made from a plan", () => {
    const copy = duplicateMenuTemplate(template, {
      newId: idFactory("n"),
      now: NOW,
      name: "Copia",
    });
    expect(frozenItems(copy.menus[0]!.meals)).toEqual(expected);
    expect(menuTemplateSchema.safeParse(copy).success).toBe(true);

    const [menu] = cloneMenuTemplate(template, {
      trainerId: "t-adrian",
      clientId: "c-marta",
      newId: idFactory("n"),
      now: NOW,
    });
    const content = menusToTemplateContent([menu!], { newId: idFactory("p"), name: "Desde plan" });
    expect(frozenItems(content.menus[0]!.meals)).toEqual(expected);
  });

  it("does not share the composition object with the original", () => {
    const item = createFoodItem(food(), 80, () => "fi-1");
    const copy = copyFoodItem(item, "fi-2");
    copy.composition!.kcal = 1;
    expect(item.composition!.kcal).toBe(372);
  });

  it("does not add the new keys to a free-text item", () => {
    expect(Object.keys(copyFoodItem(freeText, "fi-2")).sort()).toEqual(["grams", "id", "name"]);
  });
});

describe("I30: what a menu adds up to", () => {
  const avena = createFoodItem(food(), 80, () => "fi-1");
  const arroz = createFoodItem(catalogFood(), 150, () => "fi-2");
  const menu = {
    meals: [
      { items: [avena, freeText] },
      { items: [arroz, { id: "fi-pollo", name: "Pollo", grams: 150 }] },
    ],
  };

  it("adds grams × composition / 100 for library items, without rounding", () => {
    const contribution = foodItemContribution(avena)!;
    expect(contribution.kcal).toBeCloseTo(297.6, 10);
    expect(contribution.proteinG).toBeCloseTo(10.8, 10);
    expect(contribution.carbsG).toBeCloseTo(46.96, 10);
    expect(contribution.fatG).toBeCloseTo(5.6, 10);
  });

  it("does not count free-text items", () => {
    expect(foodItemContribution(freeText)).toBeNull();
    expect(mealSubtotal(menu.meals[0]!)).toEqual(foodItemContribution(avena));
    expect(mealSubtotal({ items: [freeText] })).toEqual({
      kcal: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
    });
  });

  it("sums every meal and counts the items that do not add up", () => {
    const total = menuTotal(menu);
    expect(total.kcal).toBeCloseTo(297.6 + 531);
    expect(total.fatG).toBeCloseTo(5.6 + 0.9);
    expect(countNonCountingItems(menu)).toBe(2);
    expect(countNonCountingItems({ meals: [] })).toBe(0);
  });
});

describe("menuRemaining", () => {
  const total = { kcal: 1999.6, proteinG: 120.04, carbsG: 210.06, fatG: 59.94 };

  it("reports the four states, comparing the values as they are shown", () => {
    const remaining = menuRemaining({ kcal: 2000, proteinG: 150, carbsG: 200, fatG: null }, total);
    expect(remaining.kcal).toEqual({ status: "matches" });
    expect(remaining.proteinG).toEqual({ status: "remaining", amount: 30 });
    expect(remaining.carbsG).toEqual({ status: "over", amount: 10.1 });
    expect(remaining.fatG).toEqual({ status: "no_target" });
  });

  const kcalAgainst = (sum: number) =>
    menuRemaining({ ...emptyMacrosDraft(), kcal: 2000 }, { ...total, kcal: sum }).kcal;
  const proteinAgainst = (sum: number) =>
    menuRemaining({ ...emptyMacrosDraft(), proteinG: 100 }, { ...total, proteinG: sum }).proteinG;

  it("matches kcal up to 5 off, limit included, on both sides", () => {
    expect(kcalAgainst(2005)).toEqual({ status: "matches" });
    expect(kcalAgainst(1995)).toEqual({ status: "matches" });
  });

  it("reports the real kcal difference from 6 off, on both sides", () => {
    expect(kcalAgainst(2006)).toEqual({ status: "over", amount: 6 });
    expect(kcalAgainst(1994)).toEqual({ status: "remaining", amount: 6 });
  });

  it("measures the kcal margin on the values as they are shown", () => {
    expect(kcalAgainst(2005.4)).toEqual({ status: "matches" });
    expect(kcalAgainst(2005.5)).toEqual({ status: "over", amount: 6 });
  });

  it("matches each macro up to 1 g off, limit included, on both sides", () => {
    expect(proteinAgainst(101)).toEqual({ status: "matches" });
    expect(proteinAgainst(99)).toEqual({ status: "matches" });
    expect(proteinAgainst(101.04)).toEqual({ status: "matches" });
  });

  it("reports the real macro difference from 1.1 g off, on both sides", () => {
    expect(proteinAgainst(101.1)).toEqual({ status: "over", amount: 1.1 });
    expect(proteinAgainst(98.9)).toEqual({ status: "remaining", amount: 1.1 });
    expect(proteinAgainst(101.06)).toEqual({ status: "over", amount: 1.1 });
  });

  it("returns amounts without floating-point noise", () => {
    const r = menuRemaining({ ...emptyMacrosDraft(), proteinG: 2.3 }, { ...total, proteinG: 0.1 });
    expect(r.proteinG).toEqual({ status: "remaining", amount: 2.2 });
    expect(roundGrams(0.1 + 0.2)).toBe(0.3);
  });

  it("has no target anywhere for a brand new menu", () => {
    const r = menuRemaining(emptyMacrosDraft(), total);
    expect(Object.values(r).every((s) => s.status === "no_target")).toBe(true);
  });
});

describe("parseCatalogFood", () => {
  const seeded = {
    id: "usda-171287",
    name: "Huevo entero",
    composition: { kcal: 143, proteinG: 12.56, carbsG: 0.72, fatG: 9.51 },
    status: "activo",
    source: "usda",
  };

  it("rounds a seeded food's macros to one decimal, like what the trainer writes", () => {
    const food = parseCatalogFood(seeded);
    expect(food?.composition).toEqual({ kcal: 143, proteinG: 12.6, carbsG: 0.7, fatG: 9.5 });
    expect(food?.composition.proteinG).toBe(foodDraftSchema.parse(seeded).composition.proteinG);
  });

  it("drops a food that goes over 100 g once rounded, though it did not before", () => {
    // 33.35 + 33.35 + 33.25 = 99.95 g; rounded, 33.4 + 33.4 + 33.3 = 100.1 g.
    const raw = {
      ...seeded,
      composition: { kcal: 0, proteinG: 33.35, carbsG: 33.35, fatG: 33.25 },
    };
    expect(raw.composition.proteinG + raw.composition.carbsG + raw.composition.fatG).toBeLessThan(
      100,
    );
    expect(parseCatalogFood(raw)).toBeNull();
  });

  it("drops what does not meet the schema: an unknown source, decimal kcal or no name", () => {
    expect(parseCatalogFood({ ...seeded, source: "bedca" })).toBeNull();
    expect(
      parseCatalogFood({ ...seeded, composition: { ...seeded.composition, kcal: 1.5 } }),
    ).toBeNull();
    expect(parseCatalogFood({ ...seeded, name: "" })).toBeNull();
  });
});

describe("foodNameMatchRank", () => {
  it("ignores case and accents: «platano» finds «Plátano»", () => {
    expect(matchesFoodName("Plátano", "platano")).toBe(true);
    expect(matchesFoodName("plátano de canarias", "PLÁTANO")).toBe(true);
    expect(matchesFoodName("Piña", "pina")).toBe(true);
  });

  it("ranks a name that starts with the text, then one with a word that does, then one that contains it", () => {
    expect(foodNameMatchRank("Arroz basmati", "arr")).toBe(0);
    expect(foodNameMatchRank("Tortitas de arroz", "arr")).toBe(1);
    expect(foodNameMatchRank("Harina de garroba", "arr")).toBe(2);
    expect(foodNameMatchRank("Pechuga de pollo", "arr")).toBeNull();
  });

  it("matches inside a word only from 3 letters on, like the catalog", () => {
    expect(foodNameMatchRank("Harina", "ar")).toBeNull();
    expect(foodNameMatchRank("Harina", "ari")).toBe(2);
  });

  it("matches everything with an empty or blank text", () => {
    expect(foodNameMatchRank("Nueces", "")).toBe(0);
    expect(foodNameMatchRank("Nueces", "   ")).toBe(0);
  });
});

describe("mergeFoodLibrary", () => {
  it("marks own foods as own, a trainer's catalog food as someone else's and a seeded one with its source", () => {
    const library = mergeFoodLibrary(
      [food()],
      [
        catalogFood(),
        catalogFood({ id: "usda-1", source: "usda" }),
        catalogFood({ id: "off-1", source: "off" }),
      ],
    );
    expect(library.map((f) => [f.id, f.origin])).toEqual([
      ["food-avena", "own"],
      ["food-arroz", "other"],
      ["usda-1", "seeded"],
      ["off-1", "seeded"],
    ]);
    expect(library[1]).not.toHaveProperty("trainerId");
    expect(library.slice(2).map((f) => (f.origin === "seeded" ? f.source : null))).toEqual([
      "usda",
      "off",
    ]);
  });

  it("keeps the own copy when a food is in both, because the catalog can lag behind", () => {
    const own = food({ name: "Avena (corregida)", publishStatus: "pendiente" });
    const stale = catalogFood({ id: own.id, name: "Copos de avena" });
    const library = mergeFoodLibrary([own], [stale]);
    expect(library).toHaveLength(1);
    expect(library[0]).toMatchObject({ origin: "own", name: "Avena (corregida)" });
  });

  it("leaves archived foods out, including one the catalog still serves as active", () => {
    const archived = food({ status: "archivado", publishStatus: "pendiente" });
    const stillActive = catalogFood({ id: archived.id });
    const otherArchived = catalogFood({ id: "food-x", status: "archivado" });
    expect(mergeFoodLibrary([archived], [stillActive, otherArchived])).toEqual([]);
  });

  it("filters the own copy by the text, with the same matching as the catalog", () => {
    const own = [food(), food({ id: "food-platano", name: "Plátano" })];
    const library = mergeFoodLibrary(own, [], "platano");
    expect(library.map((f) => f.id)).toEqual(["food-platano"]);
  });

  it("covers the catalog with the whole own copy, not just what matches the text", () => {
    // Renamed and not yet published: the catalog still finds it by its old name.
    const renamed = food({ name: "Avena integral", publishStatus: "pendiente" });
    const stale = catalogFood({ id: renamed.id, name: "Copos de avena" });
    expect(mergeFoodLibrary([renamed], [stale], "copos")).toEqual([]);
  });
});
