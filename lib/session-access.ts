import type { Session } from "@/lib/data/ports";

/** Las dos áreas de la app: el panel del entrenador y el área de cliente. */
export type Area = "trainer" | "client";

/**
 * Quién entra en cada área. El panel es solo de entrenador. El área de cliente pide un cliente con
 * quien navegar: un cliente real siempre lo tiene y un entrenador real no, así que cada cual se
 * queda en la suya; la sesión de demo (entrenador con un cliente a mano) puede ver las dos.
 */
export function canEnter(area: Area, session: Session): boolean {
  if (session.role === null) return false;
  return area === "trainer" ? session.role === "trainer" : session.clientId !== null;
}

/** Dónde empieza cada sesión: el panel de control o la rutina del cliente. `/login` sin cuenta. */
export function homePath(session: Session): string {
  if (session.role === null) return "/login";
  return session.role === "trainer" ? "/dashboard" : "/routine";
}
