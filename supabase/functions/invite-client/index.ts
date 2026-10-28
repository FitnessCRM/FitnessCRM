// Invita por correo a un cliente `invitado` de quien llama (docs/plan-migracion-supabase.md, Fase 6).
// Solo el entrenador dueño del cliente puede pedirlo: la cuenta de quien llama lee sus datos con RLS,
// y la clave de servicio, que puede crear cuentas, solo se usa después de esa comprobación.
// Habla con la API REST y de Auth por HTTP: el SDK de Supabase solo entra en lib/data/adapters/supabase/.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
/** Una fila leída con RLS como quien llama; `null` si no hay ninguna o la consulta falla. */
async function selectOne<T>(path: string, authorization: string): Promise<T | null> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: authorization,
      Accept: "application/json",
    },
  });
  if (!response.ok) return null;
  const rows = (await response.json()) as T[];
  return rows[0] ?? null;
}

Deno.serve(async (request) => {
  // `INVITE_URL` es la página de la app que recibe la invitación (`/accept-invite`), sin datos
  // personales. Se lee aquí y no al cargar el módulo: si falta, la petición responde un error de
  // configuración en vez de tirar el worker entero.
  const inviteUrl = Deno.env.get("INVITE_URL") ?? "";
  let origin: string;
  try {
    origin = new URL(inviteUrl).origin;
  } catch {
    return new Response(JSON.stringify({ code: "invitation.misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  const reply = (status: number, body: Record<string, unknown>): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return reply(405, { code: "method_not_allowed" });

  const body = (await request.json().catch(() => null)) as {
    trainerId?: unknown;
    clientId?: unknown;
  } | null;
  if (typeof body?.trainerId !== "string" || typeof body?.clientId !== "string") {
    return reply(400, {
      code: "invitation.invalid_request",
      message: "Faltan el entrenador o el cliente",
    });
  }
  const { trainerId, clientId } = body;

  const authorization = request.headers.get("Authorization") ?? "";
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: authorization },
  });
  if (!userResponse.ok) return reply(401, { code: "session.unauthorized" });
  const user = (await userResponse.json()) as { id: string };

  const profile = await selectOne<{ role: string; trainer_id: string | null }>(
    `profiles?select=role,trainer_id&user_id=eq.${encodeURIComponent(user.id)}`,
    authorization,
  );
  if (profile?.role !== "trainer" || profile.trainer_id !== trainerId) {
    return reply(404, { code: "not_found", message: "Cliente no encontrado" });
  }

  const client = await selectOne<{ id: string; email: string; status: string }>(
    `clients?select=id,email,status&trainer_id=eq.${encodeURIComponent(trainerId)}&id=eq.${encodeURIComponent(clientId)}`,
    authorization,
  );
  if (!client) return reply(404, { code: "not_found", message: "Cliente no encontrado" });
  if (client.status !== "invitado") {
    return reply(409, {
      code: "invitation.not_invited",
      message: "El cliente ya no está pendiente de entrar",
    });
  }

  // Única escritura con la clave de servicio: crear la cuenta del invitado y mandar el correo.
  const redirectTo = `${inviteUrl}?c=${encodeURIComponent(client.id)}`;
  const invite = await fetch(
    `${SUPABASE_URL}/auth/v1/invite?redirect_to=${encodeURIComponent(redirectTo)}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: client.email }),
    },
  );
  if (!invite.ok) {
    return reply(502, {
      code: "invitation.send_failed",
      message: "No se pudo enviar la invitación",
    });
  }

  return reply(200, { ok: true });
});
