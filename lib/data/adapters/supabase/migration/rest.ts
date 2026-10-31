/**
 * Escritura en Supabase por la API REST con `fetch`, para los cargadores de la migración (tarjeta
 * 119). Sin SDK: el de Supabase solo se importa desde `lib/data/adapters/supabase/`, y aquí se
 * escribe con la clave de servicio, que salta RLS: por eso, salvo destino remoto explícito, solo corre
 * contra la instancia local.
 */

export interface LoadTarget {
  /** Base de la API, p. ej. `http://127.0.0.1:54321`. Pasa por `assertTarget` antes de usarla. */
  url: string;
  /** Clave de servicio: nunca se imprime ni se guarda. */
  serviceKey: string;
  /** Destino remoto. Solo lo activa la CLI con `--remote`; sin esta marca, la carga es local. */
  remote?: boolean;
  /**
   * Pone las contraseñas de prueba a las cuentas que ya existen. Por defecto solo en local; en remoto
   * hace falta pedirlo con `--remote-dev-passwords`.
   */
  devPasswords?: boolean;
  fetch?: typeof fetch;
}

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

/** Tamaño de cada envío: PostgREST admite cargas grandes, pero una tanda por petición es más fácil de seguir. */
const BATCH_SIZE = 500;

/** Solo se carga contra la instancia local. Subir a producción es otra decisión, no un parámetro. */
export function assertLocalUrl(url: string): void {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("La URL de Supabase no es válida.");
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`La carga solo corre contra la instancia local, y «${host}» no lo es.`);
  }
}

/** Local por defecto. Remoto solo si el destino lo marca, y entonces exige https. */
export function assertTarget(target: Pick<LoadTarget, "url" | "remote">): void {
  if (!target.remote) {
    assertLocalUrl(target.url);
    return;
  }
  let protocol: string;
  try {
    protocol = new URL(target.url).protocol;
  } catch {
    throw new Error("La URL de Supabase no es válida.");
  }
  if (protocol !== "https:") throw new Error("La carga remota exige una URL https.");
}

export function serviceHeaders(serviceKey: string): Record<string, string> {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
}

/**
 * Inserta o actualiza filas por su clave. Idempotente: volver a cargar deja las mismas filas. Solo
 * se lee de la respuesta el código y el mensaje de PostgREST, nunca los datos enviados.
 */
export async function upsertRows(
  target: LoadTarget,
  table: string,
  onConflict: string,
  rows: object[],
): Promise<void> {
  const send = target.fetch ?? fetch;
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE);
    const res = await send(`${target.url}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: "POST",
      headers: {
        ...serviceHeaders(target.serviceKey),
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const detail = await readPostgrestError(res);
      throw new Error(`REST ${res.status} al escribir ${table}${detail}.`);
    }
  }
}

async function readPostgrestError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { code?: unknown; message?: unknown };
    const code = typeof body.code === "string" ? body.code : undefined;
    const message = typeof body.message === "string" ? body.message : undefined;
    if (!code && !message) return "";
    return ` (${[code, message].filter(Boolean).join(": ")})`;
  } catch {
    return "";
  }
}
