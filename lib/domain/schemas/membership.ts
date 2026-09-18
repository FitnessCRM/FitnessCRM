import { z } from "zod";
import { civilDateSchema, idSchema, isoTimestampSchema, tenantFields } from "./primitives";

export const membershipTypeSchema = z.enum(["mensual", "trimestral", "semestral", "anual"]);
export type MembershipType = z.infer<typeof membershipTypeSchema>;

export const paymentStatusSchema = z.enum(["pagada", "no_pagada"]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

/**
 * Membresía: periodo contratado y su estado de pago. Nunca importes ni datos de pago (I21).
 * Las renovaciones son filas nuevas; el historial del cliente es la lista completa (§7).
 */
export const membershipSchema = z
  .object({
    ...tenantFields,
    clientId: idSchema,
    type: membershipTypeSchema,
    startDate: civilDateSchema,
    endDate: civilDateSchema,
    paymentStatus: paymentStatusSchema,
    createdAt: isoTimestampSchema,
  })
  .refine((m) => m.endDate >= m.startDate, {
    message: "La fecha de fin no puede ser anterior a la de inicio",
    path: ["endDate"],
  });
export type Membership = z.infer<typeof membershipSchema>;
