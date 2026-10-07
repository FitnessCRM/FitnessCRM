import { z } from "zod";
import {
  idSchema,
  isoTimestampSchema,
  nonEmptyTextSchema,
  nonNegativeIntSchema,
  tenantFields,
} from "./primitives";

/** Décimas de gramo por gramo: la composición se guarda con un decimal como mucho. */
const TENTHS_PER_GRAM = 10;

/** El tope de proteína + carbohidratos + grasa en 100 g de alimento (§5). */
export const COMPOSITION_MAX_MACROS_G = 100;

/** Gramos en décimas enteras: así se suma, se compara y se resta sin error de coma flotante. */
export function gramsToTenths(grams: number): number {
  return Math.round(grams * TENTHS_PER_GRAM);
}

/**
 * Gramos a un decimal. Es el redondeo de presentación de lo calculado (§5) y el que se aplica a lo
 * que escribe el entrenador en una composición: 3,55 → 3,6.
 */
export function roundGrams(grams: number): number {
  return gramsToTenths(grams) / TENTHS_PER_GRAM;
}

/** Gramos de un macro en 100 g de alimento, guardados: ≥ 0 y con un decimal como mucho. */
const compositionGramsSchema = z
  .number()
  .nonnegative()
  .multipleOf(1 / TENTHS_PER_GRAM);

/**
 * Suma de los macros en décimas enteras. Cada macro ya tiene un decimal como mucho, así que
 * redondear a la décima no cambia su valor y deja fuera el error de coma flotante:
 * 0,2 + 83,9 + 15,9 suma 100 exacto aunque en coma flotante dé 100,00000000000001.
 */
function macrosTenths(c: { proteinG: number; carbsG: number; fatG: number }): number {
  return gramsToTenths(c.proteinG) + gramsToTenths(c.carbsG) + gramsToTenths(c.fatG);
}

/**
 * `Composicion` (§5): lo que aportan 100 g de un alimento. Las cuatro cifras las escribe el
 * entrenador: las kcal, un entero ≥ 0 que no se deriva con 4/4/9; los macros, en gramos ≥ 0, y los
 * tres juntos no pasan de 100 g. Ese tope es físico y está para cazar erratas.
 */
export const compositionSchema = z
  .object({
    kcal: nonNegativeIntSchema,
    proteinG: compositionGramsSchema,
    carbsG: compositionGramsSchema,
    fatG: compositionGramsSchema,
  })
  .refine((c) => macrosTenths(c) <= COMPOSITION_MAX_MACROS_G * TENTHS_PER_GRAM, {
    message: "Proteína, carbohidratos y grasa no pueden pasar de 100 g por cada 100 g",
  });
export type Composition = z.infer<typeof compositionSchema>;

/** Un macro tal como lo escribe el entrenador: ≥ 0 y se redondea a un decimal al guardar. */
const compositionGramsInputSchema = z.number().nonnegative().transform(roundGrams);

/**
 * La composición tal como la escribe el entrenador. Los macros con más de un decimal se redondean
 * (3,55 → 3,6) y el tope de 100 g se comprueba ya redondeado. Las kcal no se redondean: con
 * decimales siguen siendo un error.
 */
export const compositionInputSchema = z
  .object({
    kcal: nonNegativeIntSchema,
    proteinG: compositionGramsInputSchema,
    carbsG: compositionGramsInputSchema,
    fatG: compositionGramsInputSchema,
  })
  .pipe(compositionSchema);

/** Ciclo de vida del alimento (§7). «Eliminar» en la UI es archivar (I13). */
export const foodStatusSchema = z.enum(["activo", "archivado"]);
export type FoodStatus = z.infer<typeof foodStatusSchema>;

/**
 * Estado de publicación (§7): `publicado` si el catálogo común tiene la última versión de la copia
 * propia. Cada escritura lo vuelve a dejar `pendiente`. Solo lo ve el autor.
 */
export const foodPublishStatusSchema = z.enum(["pendiente", "publicado"]);
export type FoodPublishStatus = z.infer<typeof foodPublishStatusSchema>;

/**
 * Alimento en la copia propia de su autor (§4): la fuente de verdad, con `trainerId` (I1, I28).
 * Se duplica en el catálogo común con el mismo `id`.
 */
export const foodSchema = z.object({
  ...tenantFields,
  name: nonEmptyTextSchema,
  composition: compositionSchema,
  status: foodStatusSchema,
  publishStatus: foodPublishStatusSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});
export type Food = z.infer<typeof foodSchema>;

/**
 * Alimento tal como llega del catálogo común. Sin `trainerId` ni ningún otro dato del autor: de un
 * alimento ajeno solo se sabe que es «de otro» (§4). Sin `publishStatus`, que es de la copia propia.
 * Lleva `status` para que un archivado que el catálogo aún sirva no vuelva a la biblioteca.
 */
export const catalogFoodSchema = z.object({
  id: idSchema,
  name: nonEmptyTextSchema,
  composition: compositionSchema,
  status: foodStatusSchema,
});
export type CatalogFood = z.infer<typeof catalogFoodSchema>;

/**
 * Lo que escribe el entrenador al crear o editar un alimento. Al validarlo, los macros de la
 * composición salen redondeados a un decimal: es lo que se guarda.
 */
export const foodDraftSchema = z.object({
  name: nonEmptyTextSchema,
  composition: compositionInputSchema,
});
export type FoodDraft = z.infer<typeof foodDraftSchema>;
