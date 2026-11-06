import { slug } from "@/lib/data/seed/ids";
import type { SeedIdFormats } from "@/lib/data/seed/library";
import { accountIdFor } from "../migration/ids";

/**
 * Ids de la siembra en Supabase (tarjeta 135). Todo sale del correo del entrenador, así que repetir
 * la siembra cae sobre las mismas filas y dos entrenadores sembrados no comparten ni un id.
 *
 * - La cuenta del entrenador es `accountIdFor("seed-trainer:<correo>")`: ese uuid es a la vez el
 *   usuario de Auth, `trainers.id` y el `profiles.user_id` del entrenador. Una cuenta que no creó la
 *   siembra no puede tener ese id.
 * - Lo demás lleva el prefijo `seed-<uuid del entrenador>-` y pasa por las mismas funciones que la
 *   migración (`entityIdFor`, `clientIdFor`, `childIdFor`), con su espacio de nombres. No choca con
 *   lo migrado de Firebase: allí ningún id tiene esa forma.
 * - La cuenta de un cliente es `accountIdFor("seed-client:<correo>")`.
 */

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/** El id del entrenador dentro del plan de dominio; `accountIdFor` lo convierte en su uuid. */
export const seedTrainerKey = (email: string): string => `seed-trainer:${normalizeEmail(email)}`;

export const seedTrainerUserId = (email: string): string => accountIdFor(seedTrainerKey(email));

export const seedClientKey = (email: string): string => `seed-client:${normalizeEmail(email)}`;

export const seedClientUserId = (email: string): string => accountIdFor(seedClientKey(email));

export const seedIdPrefix = (trainerUserId: string): string => `seed-${trainerUserId}-`;

/**
 * Pesajes, series y revisiones: la clave natural de cada uno, que luego `entityIdFor` convierte en
 * uuid. Es la misma forma que usa Firestore, pero aquí solo importa que sea determinista.
 */
export const SUPABASE_SEED_IDS: SeedIdFormats = {
  weightLog: (clientId, date) => `${clientId}_${date}`,
  workoutLog: (clientId, line, date, setNumber) => `${clientId}_${line}_${date}_${setNumber}`,
  review: (clientId, weekNumber) => `${clientId}_${weekNumber}`,
};

/**
 * El correo de un cliente sembrado sin cuenta. `.invalid` es un dominio reservado (RFC 2606) que
 * nunca entrega correo, y el sufijo del entrenador lo hace único en la plataforma (I31).
 */
export const placeholderEmail = (
  firstName: string,
  lastName: string,
  trainerUserId: string,
): string => `${slug(firstName)}.${slug(lastName)}+${trainerUserId.slice(0, 8)}@demo.invalid`;
