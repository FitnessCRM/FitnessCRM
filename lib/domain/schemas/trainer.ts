import { z } from "zod";
import { idSchema, isoTimestampSchema, nonEmptyTextSchema, timeZoneSchema } from "./primitives";

/**
 * Entrenador: raíz de tenancy. Sus catálogos (preguntas, tipos de medida) viven en sus
 * propios esquemas con `trainerId`, pero pertenecen a este agregado.
 */
export const trainerSchema = z.object({
  id: idSchema,
  name: nonEmptyTextSchema,
  email: z.email(),
  /** Zona en la que se calculan las semanas (§8) y se interpretan las fechas civiles. */
  timeZone: timeZoneSchema,
  createdAt: isoTimestampSchema,
});
export type Trainer = z.infer<typeof trainerSchema>;
