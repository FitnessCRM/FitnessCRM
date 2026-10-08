import type { MacrosDraft } from "./macros";
import {
  catalogFoodInputSchema,
  gramsToTenths,
  type CatalogFood,
  type Composition,
  type Food,
  type FoodItem,
  type FoodSource,
  type Meal,
} from "./schemas";
import type { NewId } from "./templates";
import { foldText } from "./text";

/* ---------- Alimento del menú: de la biblioteca o de texto libre (§5) ---------- */

/**
 * Alimento del menú que sale de la biblioteca: `foodId` y copia congelada del nombre y de la
 * composición de ahora (I29). La composición se copia, no se comparte: corregir el alimento después
 * no la toca.
 */
export function createFoodItem(
  food: Pick<Food | CatalogFood, "id" | "name" | "composition">,
  grams: number,
  newId: NewId,
): FoodItem {
  return {
    id: newId(),
    name: food.name,
    grams,
    foodId: food.id,
    composition: { ...food.composition },
  };
}

/**
 * Cambia el nombre de un alimento del menú. Si el nombre cambia, pasa a ser de texto libre: pierde
 * `foodId` y composición, que dejarían de corresponder al nombre (§5). Con el mismo nombre no cambia.
 */
export function renameFoodItem(item: FoodItem, name: string): FoodItem {
  if (name === item.name) return item;
  return { id: item.id, name, grams: item.grams };
}

/** Cambia los gramos sin perder el vínculo con la biblioteca (§5). */
export function setFoodItemGrams(item: FoodItem, grams: number): FoodItem {
  return { ...item, grams };
}

/**
 * Copia de un alimento del menú con id nuevo, para clonar y duplicar plantillas y menús. Conserva la
 * copia congelada tal cual, sin refrescarla desde la biblioteca (I29), y no añade claves que el
 * original no tenga: un alimento de texto libre sigue sin `foodId` ni `composition`.
 */
export function copyFoodItem(item: FoodItem, id: string): FoodItem {
  const copy: FoodItem = { id, name: item.name, grams: item.grams };
  if (item.foodId !== undefined && item.composition !== undefined) {
    copy.foodId = item.foodId;
    copy.composition = { ...item.composition };
  }
  return copy;
}

/* ---------- Lo que aporta un menú (I30). Sin redondear: se redondea al presentar ---------- */

/** Kcal y gramos de macros que suman unos alimentos. Sin redondear. */
export interface NutrientTotals {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

const NUTRIENT_KEYS = ["kcal", "proteinG", "carbsG", "fatG"] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

function zeroTotals(): NutrientTotals {
  return { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
}

function addTotals(a: NutrientTotals, b: NutrientTotals): NutrientTotals {
  return {
    kcal: a.kcal + b.kcal,
    proteinG: a.proteinG + b.proteinG,
    carbsG: a.carbsG + b.carbsG,
    fatG: a.fatG + b.fatG,
  };
}

/** Lo que aportan unos gramos de un alimento: gramos × composición / 100. */
function scaleComposition(composition: Composition, grams: number): NutrientTotals {
  const factor = grams / 100;
  return {
    kcal: composition.kcal * factor,
    proteinG: composition.proteinG * factor,
    carbsG: composition.carbsG * factor,
    fatG: composition.fatG * factor,
  };
}

/** Lo que aporta un alimento del menú. `null` si es de texto libre: no suma (I30). */
export function foodItemContribution(item: FoodItem): NutrientTotals | null {
  return item.composition ? scaleComposition(item.composition, item.grams) : null;
}

/** Subtotal de una comida: lo que suman sus alimentos con composición. */
export function mealSubtotal(meal: Pick<Meal, "items">): NutrientTotals {
  return meal.items.reduce((total, item) => {
    const contribution = foodItemContribution(item);
    return contribution ? addTotals(total, contribution) : total;
  }, zeroTotals());
}

/** Lo que suman todos los alimentos con composición de un menú. No se guarda: se calcula (§2). */
export function menuTotal(menu: { meals: readonly Pick<Meal, "items">[] }): NutrientTotals {
  return menu.meals.reduce((total, meal) => addTotals(total, mealSubtotal(meal)), zeroTotals());
}

/** Cuántos alimentos del menú no suman porque son de texto libre (I30: se avisa de ellos). */
export function countNonCountingItems(menu: { meals: readonly Pick<Meal, "items">[] }): number {
  return menu.meals.reduce(
    (count, meal) => count + meal.items.filter((item) => !item.composition).length,
    0,
  );
}

/* ---------- Redondeo al presentar (§5): kcal a entero, gramos a un decimal ---------- */

/** Kcal a entero. Los gramos se redondean con `roundGrams`, junto al esquema de la composición. */
export function roundKcal(kcal: number): number {
  return Math.round(kcal);
}

/* ---------- Lo que queda frente a las macros del menú (I30) ---------- */

/**
 * Margen de «Cuadra» (§5): la diferencia máxima, límite incluido, entre lo declarado y lo que suman
 * los alimentos para dar una cifra por cuadrada. Se mide sobre los valores redondeados como se
 * presentan. Decidido el 08-10-2026.
 */
export const MENU_MATCH_TOLERANCE_KCAL = 5;
export const MENU_MATCH_TOLERANCE_GRAMS = 1;

/**
 * Lo que queda de una cifra del menú. Se compara lo redondeado como se presenta, y «cuadra» si la
 * diferencia no pasa del margen (§5). `amount` es siempre positivo, redondeado: la diferencia real,
 * no lo que pasa del margen.
 * - `no_target`: el entrenador aún no ha escrito esa cifra del menú.
 * - `remaining`: los alimentos suman menos, fuera del margen; quedan `amount`.
 * - `matches`: cuadra.
 * - `over`: los alimentos suman más, fuera del margen; se pasa en `amount`.
 */
export type RemainingStatus =
  | { status: "no_target" }
  | { status: "remaining"; amount: number }
  | { status: "matches" }
  | { status: "over"; amount: number };

export type MenuRemaining = Record<NutrientKey, RemainingStatus>;

/**
 * Compara en unidades enteras de presentación (kcal o décimas de gramo), para que el margen no
 * dependa de la coma flotante, y vuelve a la unidad.
 */
function compareRounded(target: number, total: number, key: NutrientKey): RemainingStatus {
  const isKcal = key === "kcal";
  const toUnits = isKcal ? roundKcal : gramsToTenths;
  const fromUnits = isKcal ? (units: number) => units : (units: number) => units / 10;
  const tolerance = toUnits(isKcal ? MENU_MATCH_TOLERANCE_KCAL : MENU_MATCH_TOLERANCE_GRAMS);
  const diff = toUnits(target) - toUnits(total);
  if (Math.abs(diff) <= tolerance) return { status: "matches" };
  return diff > 0
    ? { status: "remaining", amount: fromUnits(diff) }
    : { status: "over", amount: fromUnits(-diff) };
}

/**
 * Lo que queda, por kcal y por macro, entre lo que el entrenador declara para el menú y lo que suman
 * sus alimentos. Se mide contra el propio menú, nunca contra `MacroTargets` (§5). Trabaja sobre el
 * borrador porque en el editor las macros pueden estar vacías. Avisa; no bloquea nada (I30).
 */
export function menuRemaining(declared: MacrosDraft, total: NutrientTotals): MenuRemaining {
  const result = {} as MenuRemaining;
  for (const key of NUTRIENT_KEYS) {
    const target = declared[key];
    result[key] =
      target === null ? { status: "no_target" } : compareRounded(target, total[key], key);
  }
  return result;
}

/* ---------- Lo que llega del catálogo común (§5) ---------- */

/**
 * Lee un alimento tal como lo sirve el catálogo. Los macros con más de un decimal se redondean a uno,
 * como lo que escribe el entrenador, y el tope de 100 g se comprueba ya redondeado. `null` si no es
 * válido: el adaptador lo descarta sin hacer fallar la página entera, porque un alimento del
 * catálogo que pasa del tope no se ofrece (§5).
 */
export function parseCatalogFood(raw: unknown): CatalogFood | null {
  const result = catalogFoodInputSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/* ---------- Búsqueda por nombre (§4) ---------- */

/**
 * Con menos letras que esto, un nombre solo coincide si empieza por el texto o si tiene una palabra
 * que empieza por él: como en el catálogo, que con menos de 3 letras no compara trigramas.
 */
export const FOOD_SEARCH_MIN_CONTAINS_LENGTH = 3;

/**
 * Cuánto se parece un nombre al texto buscado, con el mismo criterio con que busca el catálogo común
 * y sin distinguir mayúsculas ni tildes: 0 si el nombre empieza por el texto, 1 si tiene una palabra
 * que empieza por él, 2 si lo contiene en otro sitio (solo con 3 letras o más), `null` si no
 * coincide. Con el texto vacío, todo coincide con 0. La API además encuentra los parecidos
 * (erratas); esto no, y es la única diferencia.
 */
export function foodNameMatchRank(name: string, text: string): 0 | 1 | 2 | null {
  const query = foldText(text);
  if (query === "") return 0;
  const folded = foldText(name);
  if (folded.startsWith(query)) return 0;
  if (` ${folded}`.includes(` ${query}`)) return 1;
  if (query.length >= FOOD_SEARCH_MIN_CONTAINS_LENGTH && folded.includes(query)) return 2;
  return null;
}

/** Si un nombre coincide con el texto buscado (`foodNameMatchRank`). Con el texto vacío, siempre. */
export function matchesFoodName(name: string, text: string): boolean {
  return foodNameMatchRank(name, text) !== null;
}

/* ---------- Biblioteca: copia propia + catálogo común, unidos por id (§4) ---------- */

/** La fuente de un alimento sembrado: todas menos `trainer`. */
export type SeededFoodSource = Exclude<FoodSource, "trainer">;

/**
 * Un alimento de la biblioteca de un entrenador con su origen (§4): `own` si está en su copia
 * propia; `other` si solo llega del catálogo y es de otro entrenador, del que no se sabe nada más; y
 * `seeded` si llega sembrado, con su fuente.
 */
export type LibraryFood =
  | (Food & { origin: "own" })
  | (CatalogFood & { origin: "other"; source: "trainer" })
  | (CatalogFood & { origin: "seeded"; source: SeededFoodSource });

function catalogOrigin(food: CatalogFood): LibraryFood {
  return food.source === "trainer"
    ? { ...food, source: food.source, origin: "other" }
    : { ...food, source: food.source, origin: "seeded" };
}

/**
 * La biblioteca de un entrenador: la unión por `id` de su copia propia y de lo que llega del
 * catálogo común (§4). Si un alimento está en los dos manda la copia propia, porque el catálogo puede
 * ir por detrás (`pendiente`). Los archivados no salen, vengan de donde vengan; por eso `own` tiene
 * que traer también los propios archivados que el catálogo aún pueda servir como activos (los
 * `pendiente`), o saldrían como ajenos.
 *
 * Con `text`, de la copia propia salen solo los que coinciden (`matchesFoodName`), pero tapa al
 * catálogo la copia entera: un propio renombrado y aún sin publicar que el catálogo encuentra por su
 * nombre viejo no vuelve como ajeno. Lo del catálogo no se filtra: ya llega buscado. Primero los
 * propios y después lo del catálogo, cada grupo en el orden en que llega: ordenar es cosa de la
 * pantalla.
 */
export function mergeFoodLibrary(
  own: readonly Food[],
  catalog: readonly CatalogFood[],
  text = "",
): LibraryFood[] {
  const ownIds = new Set(own.map((food) => food.id));
  return [
    ...own
      .filter((food) => matchesFoodName(food.name, text))
      .map((food) => ({ ...food, origin: "own" as const })),
    ...catalog.filter((food) => !ownIds.has(food.id)).map(catalogOrigin),
  ].filter((food) => food.status === "activo");
}
