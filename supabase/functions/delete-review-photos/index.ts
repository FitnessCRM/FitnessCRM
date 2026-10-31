// Borra las fotos de revisión que una sustitución ha dejado sin uso (Fase 4.5). Solo la cliente dueña
// de la carpeta puede pedirlo, y nunca una ruta que aún esté registrada en `review_media`: aunque la
// petición llegue con una ruta viva, la foto se queda.
// Habla con la API REST y de Storage por HTTP: el SDK de Supabase solo entra en lib/data/adapters/supabase/.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BUCKET = "review-photos";
/** Una sustitución deja una foto; el límite solo acota a quien llame a mano. */
const MAX_PATHS = 10;

/** Las filas de una consulta REST; `null` si la consulta falla. */
async function selectRows<T>(path: string, headers: Record<string, string>): Promise<T[] | null> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { ...headers, Accept: "application/json" },
  });
  if (!response.ok) return null;
  return (await response.json()) as T[];
}

Deno.serve(async (request) => {
  // Igual que `invite-client`: el origen de la app sale de `INVITE_URL`, para el CORS del navegador.
  const inviteUrl = Deno.env.get("INVITE_URL") ?? "";
  let origin: string;
  try {
    origin = new URL(inviteUrl).origin;
  } catch {
    return new Response(JSON.stringify({ code: "media.misconfigured" }), {
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

  const body = (await request.json().catch(() => null)) as { paths?: unknown } | null;
  if (
    !Array.isArray(body?.paths) ||
    body.paths.length === 0 ||
    body.paths.length > MAX_PATHS ||
    !body.paths.every((path) => typeof path === "string")
  ) {
    return reply(400, { code: "media.invalid_request", message: "Faltan las rutas de las fotos" });
  }
  const paths = body.paths as string[];

  // Quién llama, con su propia sesión: la función no confía en lo que diga el cuerpo.
  const authorization = request.headers.get("Authorization") ?? "";
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: authorization },
  });
  if (!userResponse.ok) return reply(401, { code: "session.unauthorized" });
  const user = (await userResponse.json()) as { id: string };

  const profiles = await selectRows<{
    role: string;
    trainer_id: string | null;
    client_id: string | null;
  }>(`profiles?select=role,trainer_id,client_id&user_id=eq.${encodeURIComponent(user.id)}`, {
    apikey: SUPABASE_ANON_KEY,
    Authorization: authorization,
  });
  const profile = profiles?.[0];
  if (profile?.role !== "client" || !profile.trainer_id || !profile.client_id) {
    return reply(403, {
      code: "media.forbidden",
      message: "Solo la cliente puede borrar sus fotos",
    });
  }

  // Ruta exacta {entrenador}/{cliente}/{revisión}/{archivo}, dentro de la carpeta de quien llama.
  const folder = `${profile.trainer_id}/${profile.client_id}/`;
  if (!paths.every((path) => path.startsWith(folder) && path.split("/").length === 4)) {
    return reply(403, { code: "media.wrong_folder", message: "Esa foto no es de esta cliente" });
  }

  // Con la clave de servicio: se mira si alguna ruta sigue registrada. Esas no se tocan nunca.
  const serviceHeaders = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  };
  const quoted = paths.map((path) => `"${path}"`).join(",");
  const live = await selectRows<{ storage_path: string }>(
    `review_media?select=storage_path&storage_path=in.(${encodeURIComponent(quoted)})`,
    serviceHeaders,
  );
  if (live === null) return reply(502, { code: "media.check_failed" });
  const unused = paths.filter((path) => !live.some((row) => row.storage_path === path));

  if (unused.length > 0) {
    const removal = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      headers: { ...serviceHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: unused }),
    });
    if (!removal.ok) return reply(502, { code: "media.remove_failed" });
  }

  return reply(200, { removed: unused });
});
