import { z } from "zod";
import { civilDateSchema, idSchema, isoTimestampSchema, tenantFields } from "./primitives";

export const membershipTypeSchema = z.enum(["mensual", "trimestral", "semestral", "anual"]);
export type MembershipType = z.infer<typeof membershipTypeSchema>;

export const paymentStatusSchema = z.enum(["pagada", "no_pagada"]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

const membershipFields = z.object({
  ...tenantFields,
  clientId: idSchema,
  type: membershipTypeSchema,
  startDate: civilDateSchema,
  endDate: civilDateSchema,
  paymentStatus: paymentStatusSchema,
  createdAt: isoTimestampSchema,
});

const endNotBeforeStart = {
  message: "La fecha de fin no puede ser anterior a la de inicio",
  path: ["endDate"],
};

/**
 * Membresía: periodo contratado y su estado de pago. Nunca importes ni datos de pago (I21).
 * Las renovaciones son filas nuevas; el historial del cliente es la lista completa (§7).
 */
export const membershipSchema = membershipFields.refine(
  (m) => m.endDate >= m.startDate,
  endNotBeforeStart,
);
export type Membership = z.infer<typeof membershipSchema>;

/** Lo que el entrenador puede corregir en una fila existente: nunca el cliente ni el entrenador. */
export const membershipEditSchema = membershipFields
  .pick({ type: true, startDate: true, endDate: true, paymentStatus: true })
  .refine((m) => m.endDate >= m.startDate, endNotBeforeStart);
export type MembershipEdit = z.infer<typeof membershipEditSchema>;
