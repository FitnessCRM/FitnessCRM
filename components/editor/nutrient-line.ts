import { roundGrams, roundKcal, type NutrientTotals } from "@/lib/domain";
import { formatInteger, formatNumber } from "@/lib/format";
import { es } from "@/lib/i18n/es";

const s = es.editor.menu.short;

/** Kcal como se pintan: enteras (§5). */
export const formatKcal = (kcal: number) => formatInteger(roundKcal(kcal));
/** Gramos como se pintan: a un decimal (§5). */
export const formatGrams = (grams: number) => formatNumber(roundGrams(grams));

/**
 * «297 kcal · P 10,8 · C 47 · G 5,6»: lo que aporta un alimento, lo que suma una comida o lo que
 * llevan 100 g de un alimento. Se redondea aquí, al pintar, nunca antes (§5).
 */
export function nutrientLine(totals: NutrientTotals): string {
  return [
    `${formatKcal(totals.kcal)} ${es.common.kcal}`,
    `${s.protein} ${formatGrams(totals.proteinG)}`,
    `${s.carbs} ${formatGrams(totals.carbsG)}`,
    `${s.fat} ${formatGrams(totals.fatG)}`,
  ].join(" · ");
}
