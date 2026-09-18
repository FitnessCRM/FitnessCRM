import type { Macros } from "./schemas";

/** Factores de Atwater: 4 kcal/g proteína y carbohidratos, 9 kcal/g grasa. */
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

/** Las kcal se derivan de los macros y nunca se almacenan (§5). Redondeado al entero. */
export function derivedKcal(macros: Macros): number {
  return Math.round(
    macros.proteinG * KCAL_PER_GRAM.protein +
      macros.carbsG * KCAL_PER_GRAM.carbs +
      macros.fatG * KCAL_PER_GRAM.fat,
  );
}
