// CORS de las Edge Functions que llama el navegador (tarjeta 139): `stripe-connect`, `stripe-checkout`
// y `erase-client`. El webhook de Stripe no pasa por aquí: lo llama Stripe, no un navegador.
//
// Toda respuesta lleva las cabeceras CORS, también los errores de configuración y los fallos
// inesperados: sin ellas el navegador enseña un error de CORS y el código real queda oculto. El
// OPTIONS se atiende antes que nada.
//
// El origen permitido es solo el de la app (`APP_URL` o `INVITE_URL`). Si falta ese secreto no hay
// origen que dar, y entonces, solo en esas respuestas, va `*`: la función no hace nada y la respuesta
// lleva únicamente el código del error. Sin `*` el navegador ocultaría que falta configuración.
//
// Puro: no lee `Deno.env`, así que se prueba con Vitest (`cors.test.ts`).

export const CORS_ALLOW_HEADERS = "authorization, x-client-info, apikey, content-type";

export type Reply = (status: number, body: Record<string, unknown>) => Response;

/** Las cabeceras CORS para el origen de la app; sin él (configuración incompleta), `*`. */
export function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

/** Respuestas JSON con el CORS de `origin`. */
export function responder(origin: string | null): {
  corsHeaders: Record<string, string>;
  reply: Reply;
} {
  const headers = corsHeaders(origin);
  return {
    corsHeaders: headers,
    reply: (status, body) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...headers, "Content-Type": "application/json" },
      }),
  };
}

/** El origen de una URL de la app; `null` si falta o no es una URL. */
export function originOf(url: string | undefined): string | null {
  try {
    return new URL(url ?? "").origin;
  } catch {
    return null;
  }
}

export interface BrowserFunctionOptions<Config> {
  /** El origen de la app, o `null` si falta su secreto. */
  origin: string | null;
  /** La configuración que la función necesita, o `null` si falta algo. */
  config: Config | null;
  /** El código que devuelve si falta configuración (500). */
  misconfiguredCode: string;
  /** El código que devuelve si el manejador lanza (500). */
  failureCode: string;
}

/**
 * Atiende una petición del navegador, en este orden: OPTIONS (siempre, con CORS); configuración
 * incompleta (500 con `misconfiguredCode`); método distinto de POST (405); y el manejador, que si
 * lanza da un 500 con `failureCode`. Todas las respuestas llevan CORS.
 */
export async function serveBrowserFunction<Config>(
  request: Request,
  options: BrowserFunctionOptions<Config>,
  handle: (config: Config, reply: Reply) => Promise<Response>,
): Promise<Response> {
  const { corsHeaders: headers, reply } = responder(options.origin);
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (options.config === null) return reply(500, { code: options.misconfiguredCode });
  if (request.method !== "POST") return reply(405, { code: "method_not_allowed" });
  try {
    return await handle(options.config, reply);
  } catch {
    return reply(500, { code: options.failureCode });
  }
}
