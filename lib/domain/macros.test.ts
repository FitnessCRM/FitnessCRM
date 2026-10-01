import { describe, expect, it } from "vitest";
import {
  emptyMacrosDraft,
  fromMenuDrafts,
  macroEnergyShares,
  macrosFromDraft,
  toMenuDrafts,
  type MenuEntryDraft,
} from "./macros";
import type { MenuTemplateEntry } from "./schemas";

const total = (s: { protein: number; carbs: number; fat: number }) => s.protein + s.carbs + s.fat;

describe("macroEnergyShares", () => {
  it("splits the demo training day 28/44/28", () => {
    expect(macroEnergyShares({ proteinG: 165, carbsG: 260, fatG: 72 })).toEqual({
      protein: 28,
      carbs: 44,
      fat: 28,
    });
  });

  it("always adds up to 100, even when every share has a remainder", () => {
    const shares = macroEnergyShares({ proteinG: 1, carbsG: 1, fatG: 1 });
    expect(total(shares)).toBe(100);
    expect(shares).toEqual({ protein: 24, carbs: 23, fat: 53 });
    expect(total(macroEnergyShares({ proteinG: 160, carbsG: 280, fatG: 70 }))).toBe(100);
  });

  it("is 0/0/0 when the three macros are 0, without dividing by zero", () => {
    expect(macroEnergyShares({ proteinG: 0, carbsG: 0, fatG: 0 })).toEqual({
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });

  it("ignores the kcal the trainer wrote: they are not part of the split", () => {
    const macros = { proteinG: 160, carbsG: 280, fatG: 70 };
    expect(macroEnergyShares({ ...macros, kcal: 2500 } as never)).toEqual(
      macroEnergyShares({ ...macros, kcal: 9999 } as never),
    );
  });
});

const entry: MenuTemplateEntry = {
  id: "m-1",
  name: "Menú A",
  dayType: "entrenamiento",
  suggested: true,
  macros: { kcal: 2400, proteinG: 165, carbsG: 260, fatG: 72 },
  meals: [],
  note: "",
};
const draftWith = (macros: Partial<MenuEntryDraft["macros"]>): MenuEntryDraft => ({
  ...toMenuDrafts([entry])[0]!,
  macros: { ...toMenuDrafts([entry])[0]!.macros, ...macros },
});

describe("menu drafts", () => {
  it("a menu with the four values comes back complete", () => {
    expect(fromMenuDrafts(toMenuDrafts([entry]))).toEqual([entry]);
  });

  it("returns null if any of the four values is missing", () => {
    for (const key of ["kcal", "proteinG", "carbsG", "fatG"] as const) {
      expect(fromMenuDrafts([draftWith({ [key]: null })])).toBeNull();
    }
    expect(fromMenuDrafts([{ ...entry, macros: emptyMacrosDraft() }])).toBeNull();
  });

  it("returns null with kcal at 0 or with decimals", () => {
    expect(fromMenuDrafts([draftWith({ kcal: 0 })])).toBeNull();
    expect(fromMenuDrafts([draftWith({ kcal: 2400.5 })])).toBeNull();
    expect(macrosFromDraft({ kcal: -1, proteinG: 1, carbsG: 1, fatG: 1 })).toBeNull();
  });

  it("accepts 0 g of fat when the rest is filled", () => {
    expect(fromMenuDrafts([draftWith({ fatG: 0 })])?.[0]?.macros).toEqual({
      kcal: 2400,
      proteinG: 165,
      carbsG: 260,
      fatG: 0,
    });
  });

  it("one incomplete menu blocks the whole list", () => {
    expect(fromMenuDrafts([...toMenuDrafts([entry]), draftWith({ kcal: null })])).toBeNull();
  });
});
