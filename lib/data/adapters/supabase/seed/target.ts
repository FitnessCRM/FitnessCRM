import { assertLocalUrl, type LoadTarget } from "../migration/rest";

/**
 * Contra qué Supabase se siembra (tarjeta 135). Por defecto, la instancia local de `supabase start`;
 * con `--remote`, solo el proyecto de la app. La URL y la clave de servicio salen siempre del entorno,
 * nunca de un argumento ni de un archivo del repo, y la clave no se imprime.
 */

/** El único proyecto remoto contra el que la siembra acepta ejecutarse. */
export const REMOTE_PROJECT_REF = "vrddwsnybtketbbmiuvy";

export const LOCAL_URL = "http://127.0.0.1:54321";

/** Un error que detiene la siembra antes de escribir: se enseña su mensaje y nada más. */
export class SeedAbort extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedAbort";
  }
}

export interface SeedTarget extends LoadTarget {
  remote: boolean;
}

export interface TargetInput {
  remote: boolean;
  env: Record<string, string | undefined>;
}

/**
 * Lo que dice de sí misma una clave JWT (las claves de servicio heredadas lo son): su rol y, en las
 * de un proyecto alojado, su `ref`. Una clave `sb_secret_…` no es un JWT y no dice nada.
 */
function jwtClaims(key: string): Record<string, unknown> | null {
  const parts = key.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1]!, "base64url").toString("utf8");
    const claims: unknown = JSON.parse(json);
    return typeof claims === "object" && claims !== null
      ? (claims as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function assertServiceKey(key: string, remote: boolean): void {
  if (key.startsWith("sb_publishable_")) {
    throw new SeedAbort("SUPABASE_SERVICE_ROLE_KEY es una clave publicable, no la de servicio.");
  }
  if (key.startsWith("sb_secret_")) return;
  const claims = jwtClaims(key);
  if (!claims) {
    throw new SeedAbort("SUPABASE_SERVICE_ROLE_KEY no tiene la forma de una clave de servicio.");
  }
  if (claims.role !== "service_role") {
    throw new SeedAbort(
      "SUPABASE_SERVICE_ROLE_KEY no es la clave de servicio (su rol no es service_role).",
    );
  }
  if (remote && claims.ref !== undefined && claims.ref !== REMOTE_PROJECT_REF) {
    throw new SeedAbort(
      `SUPABASE_SERVICE_ROLE_KEY es de otro proyecto, no de ${REMOTE_PROJECT_REF}.`,
    );
  }
}

export function resolveTarget({ remote, env }: TargetInput): SeedTarget {
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!serviceKey) {
    throw new SeedAbort(
      "Falta SUPABASE_SERVICE_ROLE_KEY en el entorno. También el dry-run la necesita: lee con ella.",
    );
  }

  if (!remote) {
    const url = env.SUPABASE_URL?.trim() || LOCAL_URL;
    try {
      assertLocalUrl(url);
    } catch {
      throw new SeedAbort(
        "SUPABASE_URL no es la instancia local. Para sembrar en el proyecto remoto hace falta --remote.",
      );
    }
    assertServiceKey(serviceKey, false);
    return { url: url.replace(/\/+$/, ""), serviceKey, remote: false };
  }

  const url = env.SUPABASE_URL?.trim() ?? "";
  if (!url) throw new SeedAbort("Con --remote, SUPABASE_URL es obligatoria.");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SeedAbort("SUPABASE_URL no es una URL válida.");
  }
  const expectedHost = `${REMOTE_PROJECT_REF}.supabase.co`;
  if (parsed.protocol !== "https:")
    throw new SeedAbort("Con --remote, SUPABASE_URL tiene que ser https.");
  if (parsed.hostname !== expectedHost) {
    throw new SeedAbort(
      `La siembra remota solo corre contra ${expectedHost}, y SUPABASE_URL apunta a «${parsed.hostname}».`,
    );
  }
  if (parsed.pathname.replace(/\/+$/, "") !== "" || parsed.search || parsed.port) {
    throw new SeedAbort(
      "SUPABASE_URL tiene que ser solo el origen del proyecto, sin ruta ni puerto.",
    );
  }
  assertServiceKey(serviceKey, true);
  return { url: `https://${expectedHost}`, serviceKey, remote: true };
}
