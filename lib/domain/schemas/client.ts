import { z } from "zod";
import {
  civilDateSchema,
  isoTimestampSchema,
  nonEmptyTextSchema,
  optionalTextSchema,
  positiveIntSchema,
  tenantFields,
} from "./primitives";

/** Ciclo de vida del cliente (§7). La baja conserva el histórico completo. */
export const clientStatusSchema = z.enum(["invitado", "activo", "dado_de_baja"]);
export type ClientStatus = z.infer<typeof clientStatusSchema>;

/** Cadencia orientativa de revisión: cada N días. Solo alimenta "te quedan X días" (§5). */
export const cadenceSchema = z.object({ everyDays: positiveIntSchema });
export type Cadence = z.infer<typeof cadenceSchema>;

export const clientSchema = z.object({
  ...tenantFields,
  firstName: nonEmptyTextSchema,
  lastName: nonEmptyTextSchema,
  email: z.email(),
  phone: optionalTextSchema,
  /** Objetivo y nivel salen de la pantalla de alta; el dominio no cierra la lista. */
  goal: optionalTextSchema,
  level: optionalTextSchema,
  initialNotes: optionalTextSchema,
  status: clientStatusSchema,
  /** Fecha de alta: origen de la numeración de semanas (§8). Cambiarla no reetiqueta el histórico. */
  startDate: civilDateSchema,
  reviewCadence: cadenceSchema,
  createdAt: isoTimestampSchema,
});
export type Client = z.infer<typeof clientSchema>;
