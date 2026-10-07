import { z } from "zod";

/**
 * Primitivas compartidas por todos los esquemas del dominio.
 * Sin React, sin Next, sin DOM, sin red: solo TypeScript y zod.
 */

/** Identificador opaco. El backend decidirá el formato; el dominio solo exige que no esté vacío. */
export const idSchema = z.string().min(1);
export type Id = z.infer<typeof idSchema>;

/** Fecha civil `YYYY-MM-DD`, sin hora ni zona. Para revisiones, pesajes y membresías. */
export const civilDateSchema = z.iso.date();
export type CivilDate = z.infer<typeof civilDateSchema>;

/** Instante técnico en UTC ISO 8601 (`2026-08-29T07:15:00Z`). Para createdAt, submittedAt, etc. */
export const isoTimestampSchema = z.iso.datetime();
export type IsoTimestamp = z.infer<typeof isoTimestampSchema>;

/** Enlace externo http(s). La app no aloja vídeo (I20). */
export const externalUrlSchema = z.url({ protocol: /^https?$/ });

/** Zona horaria IANA válida (`Europe/Madrid`). Es configuración del entrenador, nunca una constante. */
export const timeZoneSchema = z.string().refine(
  (tz) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: "Zona horaria IANA no válida" },
);
export type TimeZone = z.infer<typeof timeZoneSchema>;

export const nonEmptyTextSchema = z.string().trim().min(1);
/** Un correo, sin espacios alrededor: lo que se escribe en un formulario llega recortado. */
export const emailSchema = z.string().trim().pipe(z.email());
export const optionalTextSchema = z.string().trim().default("");
export const positiveIntSchema = z.int().positive();
export const nonNegativeIntSchema = z.int().nonnegative();

/** Peso corporal en kg, siempre (I18). Un decimal es lo habitual en báscula; no se fuerza. */
export const weightKgSchema = z.number().positive().max(400);

/** Gramos de un alimento o de un macronutriente. */
export const gramsSchema = z.number().nonnegative();

/** Todo agregado lleva `trainerId` denormalizado: el aislamiento multi-tenant es una comparación directa. */
export const tenantFields = {
  id: idSchema,
  trainerId: idSchema,
} as const;
