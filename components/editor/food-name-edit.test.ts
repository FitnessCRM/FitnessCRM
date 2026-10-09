import { describe, expect, it } from "vitest";
import type { FoodItem } from "@/lib/domain";
import {
  escapeFoodNameEdit,
  pickFoodForName,
  startFoodNameEdit,
  typeFoodName,
} from "./food-name-edit";

const avena: FoodItem = {
  id: "item-1",
  name: "Avena",
  grams: 80,
  foodId: "food-avena",
  composition: { kcal: 372, proteinG: 13.5, carbsG: 58.7, fatG: 7 },
};

const type = (start: FoodItem, ...texts: string[]) => {
  let edit = startFoodNameEdit(start);
  let item = start;
  for (const text of texts) ({ edit, item } = typeFoodName(edit, text));
  return { edit, item };
};

describe("food name edit", () => {
  it("unlinks while the name differs and links again when it comes back to the original", () => {
    const away = type(avena, "Avenas");
    expect(away.item).toEqual({ id: "item-1", name: "Avenas", grams: 80 });

    const back = type(avena, "Avenas", "Avena");
    expect(back.item).toBe(avena);
    expect(back.edit.text).toBe("Avena");
  });

  it("ignores the spaces at the ends but keeps them in the text being typed", () => {
    const { edit, item } = type(avena, "Avena ");
    expect(item).toBe(avena);
    expect(edit.text).toBe("Avena ");
    expect(type(avena, "Avena c").item).toEqual({ id: "item-1", name: "Avena c", grams: 80 });
  });

  it("restores the original row and text on escape, and does nothing when there is nothing to undo", () => {
    const { edit } = type(avena, "Avenas", "Pan");
    const step = escapeFoodNameEdit(edit);
    expect(step?.item).toBe(avena);
    expect(step?.edit.text).toBe("Avena");
    expect(escapeFoodNameEdit(startFoodNameEdit(avena))).toBeNull();
  });

  it("makes the picked food the new original, keeping the row id and grams", () => {
    const { edit } = type(avena, "Arr");
    const arroz = {
      id: "food-arroz",
      name: "Arroz basmati",
      composition: { kcal: 354, proteinG: 8, carbsG: 77, fatG: 0.9 },
    };
    const picked = pickFoodForName(edit, arroz);
    expect(picked.item).toEqual({
      id: "item-1",
      name: "Arroz basmati",
      grams: 80,
      foodId: "food-arroz",
      composition: arroz.composition,
    });
    expect(picked.edit.original).toBe(picked.item);

    const renamedAndBack = typeFoodName(typeFoodName(picked.edit, "Arroz").edit, "Arroz basmati");
    expect(renamedAndBack.item).toBe(picked.item);
    expect(escapeFoodNameEdit(typeFoodName(picked.edit, "Arroz").edit)?.item).toBe(picked.item);
  });

  it("leaves an empty name as an empty free-text row, as before", () => {
    expect(type(avena, "  ").item).toEqual({ id: "item-1", name: "", grams: 80 });
    const blank: FoodItem = { id: "item-2", name: "", grams: 0 };
    expect(type(blank, "Pan").item).toEqual({ id: "item-2", name: "Pan", grams: 0 });
  });
});
