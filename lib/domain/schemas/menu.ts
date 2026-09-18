import { z } from "zod";
import { macrosSchema } from "./macros";
import { dayTypeSchema, planStatusSchema } from "./plan-status";
import {
  gramsSchema,
  idSchema,
  isoTimestampSchema,
  nonEmptyTextSchema,
  optionalTextSchema,
  tenantFields,
} from "./primitives";

/** Alimento con su peso en gramos. Sin composición nutricional: el menú es sugerencia pura. */
export const foodItemSchema = z.object({
  id: idSchema,
  name: nonEmptyTextSchema,
  grams: gramsSchema,
});
export type FoodItem = z.infer<typeof foodItemSchema>;

/** Bloque del menú: desayuno, comida, merienda, cena. El nombre lo pone el entrenador. */
export const mealSchema = z.object({
  id: idSchema,
  name: nonEmptyTextSchema,
  items: z.array(foodItemSchema),
});
export type Meal = z.infer<typeof mealSchema>;

/** Estructura común a menú de cliente y a cada menú de una plantilla. */
export const menuBodySchema = z.object({
  name: nonEmptyTextSchema,
  dayType: dayTypeSchema,
  /** Varios menús por tipo de día; uno marcado como sugerido (§3). */
  suggested: z.boolean(),
  /**
   * Macros totales del menú, DECLARADAS por el entrenador. Dato informativo para el cliente:
   * no son su objetivo (eso es MacroTargets) ni se calculan a partir de los alimentos.
   */
  macros: macrosSchema,
  meals: z.array(mealSchema),
  /** Nota del entrenador visible para el cliente. */
  note: optionalTextSchema,
});
export type MenuBody = z.infer<typeof menuBodySchema>;

/** Menú asignado a un cliente. Jerarquía que solo se consulta y edita completa. */
export const menuSchema = menuBodySchema.extend({
  ...tenantFields,
  clientId: idSchema,
  status: planStatusSchema,
  sourceTemplateName: z.string().nullable(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});
export type Menu = z.infer<typeof menuSchema>;
