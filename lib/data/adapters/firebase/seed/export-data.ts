/**
 * Forma de lo que la exportación de Firebase escribe (tarjeta 119). Sin SDK: `export.ts` es el que
 * lee el proyecto, y esto se prueba sin emuladores.
 *
 * Las contraseñas no entran. El hash y el salt de Auth se quedan en Firebase: las cuentas
 * restablecen la contraseña por correo al migrar (plan, Fase 8).
 */

/** Todas las colecciones que el plan migra a Supabase. Las de `COLLECTIONS` salvo la copia común. */
export const EXPORT_COLLECTIONS = [
  "trainers",
  "clients",
  "memberships",
  "exercises",
  "foods",
  "routines",
  "macroTargets",
  "menus",
  "routineTemplates",
  "menuTemplates",
  "measurementTypes",
  "questions",
  "reviews",
  "weightLogs",
  "workoutLogs",
] as const;

/** Una referencia a otro documento, guardada como su ruta para no perderla al pasar a JSON. */
export interface SerializedRef {
  __ref: string;
}

const isTimestamp = (value: object): value is { toDate: () => Date } =>
  typeof (value as { toDate?: unknown }).toDate === "function";

const isDocumentReference = (value: object): value is { path: string } =>
  typeof (value as { path?: unknown }).path === "string" &&
  typeof (value as { withConverter?: unknown }).withConverter === "function";

/**
 * Pasa un valor de Firestore a JSON: `Timestamp` y `Date` a ISO, referencias a `{ __ref }` y el
 * resto recursivamente. Lo que no es ninguno de esos se devuelve tal cual.
 */
export function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value !== "object") return value;
  if (isTimestamp(value)) return value.toDate().toISOString();
  if (isDocumentReference(value)) return { __ref: value.path } satisfies SerializedRef;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, serializeValue(item)]),
  );
}

/** Lo que el SDK de administración devuelve de una cuenta de Auth, sin el hash ni el salt. */
export interface AuthUserInput {
  uid: string;
  email?: string;
  emailVerified: boolean;
  disabled: boolean;
  providerData: { providerId: string }[];
  metadata: { creationTime: string; lastSignInTime?: string | null };
  customClaims?: Record<string, unknown>;
}

/** Una cuenta tal como se guarda en el JSON de la exportación. */
export interface AuthAccountRecord {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  disabled: boolean;
  providers: string[];
  createdAt: string;
  lastSignInAt: string | null;
  customClaims: Record<string, unknown> | null;
}

/** Copia solo lo que la migración necesita. Cualquier otro campo del usuario se descarta aquí. */
export function toAuthAccountRecord(user: AuthUserInput): AuthAccountRecord {
  return {
    uid: user.uid,
    email: user.email ?? null,
    emailVerified: user.emailVerified,
    disabled: user.disabled,
    providers: user.providerData.map((provider) => provider.providerId),
    createdAt: user.metadata.creationTime,
    lastSignInAt: user.metadata.lastSignInTime ?? null,
    customClaims: user.customClaims ?? null,
  };
}
