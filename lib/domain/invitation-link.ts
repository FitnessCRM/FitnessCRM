/**
 * A quién invita un enlace de acceso (docs/dominio.md §12): a un cliente, que lo da de alta su
 * entrenador, o a un entrenador, que lo invita la administración de la plataforma.
 */
export type InvitationKind = "trainer" | "client";

/**
 * Lee el tipo de invitación de la dirección: `kind=trainer` es la de un entrenador y `c=` (el id del
 * cliente) la de un cliente. El enlace del correo lleva la página de la app dentro de `continueUrl`;
 * la dirección que abre el navegador, directa. Si dice las dos cosas, manda la de entrenador. `null`
 * si no dice ninguna o no es una dirección.
 */
export function invitationKind(link: string): InvitationKind | null {
  const sources = searchParamsOf(link);
  if (sources.some((params) => params.get("kind") === "trainer")) return "trainer";
  if (sources.some((params) => params.get("c"))) return "client";
  return null;
}

/** Los parámetros de la dirección y, si la lleva, los de su `continueUrl`. */
function searchParamsOf(link: string): URLSearchParams[] {
  const url = parseUrl(link);
  if (!url) return [];
  const next = url.searchParams.get("continueUrl");
  const inner = next ? parseUrl(next) : null;
  return inner ? [url.searchParams, inner.searchParams] : [url.searchParams];
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
