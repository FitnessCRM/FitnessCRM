// Borrado a petición de un cliente de baja (E11, docs/dominio.md §7 e I14). Solo su entrenador puede
// pedirlo, y sin anonimizar: se va todo. El orden permite comprobar y repetir:
//   1. `client_erasure_paths`, con la sesión de quien llama: comprueba que el cliente es suyo y está de
//      baja, y dice qué fotos tiene en Storage.
//   2. Con la clave de servicio, borra esas fotos de Storage.
//   3. `erase_client`, otra vez con la sesión de quien llama: se niega si queda alguna foto, borra
//      todas las filas del cliente y devuelve sus cuentas de Auth.
//   4. Con la clave de servicio, borra esas cuentas.
// Si un paso falla, los anteriores ya están hechos y volver a pedirlo solo hace lo que falta.
// Habla con la API REST, de Storage y de Auth por HTTP: el SDK de Supabase solo entra en
// lib/data/adapters/supabase/.
import { originOf, serveBrowserFunction, type Reply } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BUCKET = "review-photos";

/** Llama a una función SQL con la sesión de quien llama; los códigos del dominio vuelven tal cual. */
async function rpc<T>(
  name: string,
  args: Record<string, unknown>,
  authorization: string,
): Promise<{ ok: true; data: T } | { ok: false; status: number; code: string }> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (response.ok) return { ok: true, data: (await response.json()) as T };
  const error = (await response.json().catch(() => ({}))) as { code?: string; message?: string };
  // Las funciones lanzan el código del dominio como mensaje, con SQLSTATE P0001.
  const code = error.code === "P0001" && error.message ? error.message : "client.erase_incomplete";
  return { ok: false, status: response.status, code };
}

Deno.serve((request) => {
  // Igual que `invite-client`: el origen de la app sale de `INVITE_URL`, para el CORS del navegador.
  const origin = originOf(Deno.env.get("INVITE_URL"));
  return serveBrowserFunction(
    request,
    {
      origin,
      config: origin,
      misconfiguredCode: "client.erase_misconfigured",
      failureCode: "client.erase_incomplete",
    },
    (_origin, reply) => erase(request, reply),
  );
});

async function erase(request: Request, reply: Reply): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { clientId?: unknown } | null;
  if (typeof body?.clientId !== "string") {
    return reply(400, { code: "client.erase_invalid_request" });
  }
  const clientId = body.clientId;
  const authorization = request.headers.get("Authorization") ?? "";
  const serviceHeaders = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  };

  // 1. Es suyo y está de baja; qué fotos tiene.
  const paths = await rpc<string[]>(
    "client_erasure_paths",
    { p_client_id: clientId },
    authorization,
  );
  if (!paths.ok) return reply(paths.code === "client.not_found" ? 404 : 409, { code: paths.code });

  // 2. Las fotos, primero.
  if (paths.data.length > 0) {
    const removal = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      headers: { ...serviceHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: paths.data }),
    });
    if (!removal.ok) return reply(502, { code: "client.erase_incomplete", step: "photos" });
  }

  // 3. Las filas, solo si no queda ninguna foto.
  const accounts = await rpc<string[]>("erase_client", { p_client_id: clientId }, authorization);
  if (!accounts.ok) {
    return reply(accounts.code === "client.not_found" ? 404 : 409, { code: accounts.code });
  }

  // 4. Las cuentas de Auth.
  for (const userId of accounts.data) {
    const removal = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
      {
        method: "DELETE",
        headers: serviceHeaders,
      },
    );
    if (!removal.ok && removal.status !== 404) {
      return reply(502, { code: "client.erase_incomplete", step: "accounts" });
    }
  }

  return reply(200, { photos: paths.data.length, accounts: accounts.data.length });
}
