import { z } from "zod";
import { dayTypeSchema, planStatusSchema } from "./plan-status";
import {
  gramsSchema,
  idSchema,
  isoTimestampSchema,
  positiveIntSchema,
  tenantFields,
} from "./primitives";

/**
 * Kcal y macros en gramos. Los cuatro valores los escribe el entrenador y se guardan (§5): las
 * kcal no se derivan de los macros, y la app no comprueba si cuadran con 4/4/9.
 */
export const macrosSchema = z.object({
  kcal: positiveIntSchema,
  proteinG: gramsSchema,
  carbsG: gramsSchema,
  fatG: gramsSchema,
});
export type Macros = z.infer<typeof macrosSchema>;

/** Objetivo diario de un cliente para un tipo de día. Independiente del menú (I4). */
export const macroTargetsSchema = z.object({
  ...tenantFields,
  clientId: idSchema,
  dayType: dayTypeSchema,
  macros: macrosSchema,
  status: planStatusSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});
export type MacroTargets = z.infer<typeof macroTargetsSchema>;
