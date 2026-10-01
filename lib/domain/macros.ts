import { macrosSchema, type Macros, type MenuTemplateEntry } from "./schemas";

/** Factores de Atwater: solo sirven para repartir la energía entre macros, nunca para dar kcal. */
const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

export interface MacroEnergyShares {
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Cómo se reparte la energía entre los tres macros, en porcentajes enteros que suman 100
 * (reparto por mayor resto, empates en el orden proteína, carbohidratos, grasa). Si los tres
 * son 0, los tres porcentajes son 0. No lee `kcal`: esa cifra la escribe el entrenador (§5) y
 * la app no la calcula ni la compara con nada.
 */
export function macroEnergyShares(
  macros: Pick<Macros, "proteinG" | "carbsG" | "fatG">,
): MacroEnergyShares {
  const energy = [
    macros.proteinG * KCAL_PER_GRAM.protein,
    macros.carbsG * KCAL_PER_GRAM.carbs,
    macros.fatG * KCAL_PER_GRAM.fat,
  ];
  const total = energy.reduce((sum, e) => sum + e, 0);
  if (!(total > 0)) return { protein: 0, carbs: 0, fat: 0 };

  const exact = energy.map((e) => (e / total) * 100);
  const shares = exact.map(Math.floor);
  const missing = 100 - shares.reduce((sum, s) => sum + s, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let i = 0; i < missing; i++) shares[byRemainder[i]!.index]! += 1;

  return { protein: shares[0]!, carbs: shares[1]!, fat: shares[2]! };
}

/* ---------- Borradores de editor: kcal y macros que todavía pueden estar vacíos ---------- */

/** Lo que el entrenador está escribiendo: cualquiera de los cuatro puede faltar (`null`). */
export type MacrosDraft = { [K in keyof Macros]: number | null };

/** Un menú recién creado nace sin kcal ni macros: ni a 0 ni con un valor propuesto. */
export function emptyMacrosDraft(): MacrosDraft {
  return { kcal: null, proteinG: null, carbsG: null, fatG: null };
}

export function macrosToDraft(macros: Macros): MacrosDraft {
  return { ...macros };
}

/** Los cuatro rellenos y válidos según `macrosSchema` (kcal entero > 0); si no, `null`. */
export function macrosFromDraft(draft: MacrosDraft): Macros | null {
  const parsed = macrosSchema.safeParse(draft);
  return parsed.success ? parsed.data : null;
}

/** Menú de plantilla o de plan mientras se edita: igual que la entrada, con macros en borrador. */
export type MenuEntryDraft = Omit<MenuTemplateEntry, "macros"> & { macros: MacrosDraft };

export function toMenuDrafts(entries: readonly MenuTemplateEntry[]): MenuEntryDraft[] {
  return entries.map((entry) => ({ ...entry, macros: macrosToDraft(entry.macros) }));
}

/**
 * Vuelve a entradas completas. Si a algún menú le falta cualquiera de los cuatro valores, o sus
 * kcal no son un entero mayor que cero, devuelve `null`: no se puede guardar ni publicar.
 */
export function fromMenuDrafts(drafts: readonly MenuEntryDraft[]): MenuTemplateEntry[] | null {
  const entries: MenuTemplateEntry[] = [];
  for (const draft of drafts) {
    const macros = macrosFromDraft(draft.macros);
    if (!macros) return null;
    entries.push({ ...draft, macros });
  }
  return entries;
}
