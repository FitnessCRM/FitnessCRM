import { z } from "zod";
import { dayTypeSchema, planStatusSchema } from "./plan-status";
import { gramsSchema, idSchema, isoTimestampSchema, tenantFields } from "./primitives";

/** Macros en gramos. Las kcal se derivan (4/4/9) con `derivedKcal` y no se almacenan (§5). */
export const macrosSchema = z.object({
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
