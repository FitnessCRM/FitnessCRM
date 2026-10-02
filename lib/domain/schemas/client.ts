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
  /** Sin espacios alrededor: lo que se escribe en el alta llega recortado. */
  email: z.string().trim().pipe(z.email()),
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

/**
 * Los datos del cliente que escribe el entrenador, en el alta y al editarlo: el resto (id,
 * entrenador, estado, cadencia, fechas técnicas) no sale de ese formulario. Es un recorte de
 * `clientSchema`, así que las reglas son las mismas que valida el adaptador.
 */
export const clientDataSchema = clientSchema.pick({
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  goal: true,
  level: true,
  initialNotes: true,
  startDate: true,
});
export type ClientData = z.infer<typeof clientDataSchema>;
