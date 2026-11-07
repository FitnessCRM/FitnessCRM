// Piezas comunes de las Edge Functions de Stripe (tarjeta 125). Hablan con la API REST y de Auth de
// Supabase por HTTP: el SDK de Supabase solo entra en lib/data/adapters/supabase/.
import { originOf } from "./cors.ts";

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
export const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
export const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export const serviceHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
};

/**
 * El origen público de la app (`APP_URL`), al que vuelven Stripe Checkout y el alta de la cuenta, y el
 * único que admite el CORS (`cors.ts`).
 */
export function appUrl(): string | null {
  return originOf(Deno.env.get("APP_URL"));
}

/** Las filas de una consulta REST; `null` si falla. Con `authorization`, como quien llama (RLS). */
export async function selectRows<T>(path: string, authorization?: string): Promise<T[] | null> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: authorization
      ? { apikey: SUPABASE_ANON_KEY, Authorization: authorization, Accept: "application/json" }
      : { ...serviceHeaders, Accept: "application/json" },
  });
  if (!response.ok) return null;
  return (await response.json()) as T[];
}

/** El perfil de quien llama: su rol, su entrenador y, si es cliente, su ficha. */
export async function callerProfile(authorization: string): Promise<{
  userId: string;
  email: string | null;
  role: string;
  trainerId: string | null;
  clientId: string | null;
} | null> {
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: authorization },
  });
  if (!userResponse.ok) return null;
  const user = (await userResponse.json()) as { id: string; email?: string };
  const rows = await selectRows<{
    role: string;
    trainer_id: string | null;
    client_id: string | null;
  }>(
    `profiles?select=role,trainer_id,client_id&user_id=eq.${encodeURIComponent(user.id)}`,
    authorization,
  );
  const profile = rows?.[0];
  if (!profile) return null;
  return {
    userId: user.id,
    email: user.email ?? null,
    role: profile.role,
    trainerId: profile.trainer_id,
    clientId: profile.client_id,
  };
}
