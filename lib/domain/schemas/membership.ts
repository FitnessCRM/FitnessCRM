import { z } from "zod";
import { civilDateSchema, idSchema, isoTimestampSchema, tenantFields } from "./primitives";

export const membershipTypeSchema = z.enum(["mensual", "trimestral", "semestral", "anual"]);
export type MembershipType = z.infer<typeof membershipTypeSchema>;

export const paymentStatusSchema = z.enum(["pagada", "no_pagada"]);

/** Precio en céntimos de euro: entero y mayor que cero. Solo EUR, sin moneda guardada (E3). */
export const priceCentsSchema = z.number().int().positive();
export type PriceCents = z.infer<typeof priceCentsSchema>;

/**
 * Tarifa de un tipo de membresía (E1): si el entrenador la ofrece y a qué precio. Una por entrenador
 * y tipo; los cuatro tipos son la lista cerrada de `membershipTypeSchema`. Una tarifa sin fila es
 * una tarifa inactiva y sin precio.
 */
export const membershipRateSchema = z.object({
  trainerId: idSchema,
  type: membershipTypeSchema,
  active: z.boolean(),
  priceCents: priceCentsSchema.nullable(),
});
export type MembershipRate = z.infer<typeof membershipRateSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

const membershipFields = z.object({
  ...tenantFields,
  clientId: idSchema,
  type: membershipTypeSchema,
  startDate: civilDateSchema,
  endDate: civilDateSchema,
  paymentStatus: paymentStatusSchema,
  /**
   * Copia congelada del precio cobrado, en céntimos de euro (E2, E3, I21). Solo la tiene una
   * membresía pagada en línea; el registro manual no la lleva, porque la app no sabe qué se cobró.
   */
  priceCents: priceCentsSchema.nullable().default(null),
  /**
   * Id del pago en línea que la creó (I21, I34): único, y lo único del pago que guarda la app. Nunca
   * datos de tarjeta ni de cuenta. `null` en el registro manual.
   */
  onlinePaymentId: z.string().min(1).nullable().default(null),
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
