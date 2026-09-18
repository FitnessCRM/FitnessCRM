import { z } from "zod";
import {
  civilDateSchema,
  idSchema,
  isoTimestampSchema,
  optionalTextSchema,
  tenantFields,
  weightKgSchema,
} from "./primitives";

/**
 * Pesaje libre del cliente. Dato continuo: alimenta las gráficas y es la única fuente de
 * verdad del peso; la revisión lo referencia, nunca lo copia (§2, I9, I18).
 */
export const weightLogSchema = z.object({
  ...tenantFields,
  clientId: idSchema,
  date: civilDateSchema,
  weightKg: weightKgSchema,
  note: optionalTextSchema,
  createdAt: isoTimestampSchema,
});
export type WeightLog = z.infer<typeof weightLogSchema>;
