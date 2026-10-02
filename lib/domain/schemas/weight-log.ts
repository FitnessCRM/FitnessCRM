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
 * verdad del peso. La revisión lo referencia mientras es editable y guarda copia al pasar a
 * `vista` (§2, I9, I24, I18).
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
