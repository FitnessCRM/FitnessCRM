"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/data/hooks";
import { canEnter, homePath, type Area } from "@/lib/session-access";

/**
 * Deja ver un área solo a quien le corresponde y manda al resto a la suya: sin cuenta, al acceso;
 * un cliente que escribe una ruta del panel, a su rutina; un entrenador en el área de cliente, a
 * su panel. No pinta nada mientras se resuelve la sesión: así el armazón de un área no parpadea
 * ante quien no puede verla.
 */
export function RoleGate({ area, children }: { area: Area; children: ReactNode }) {
  const router = useRouter();
  const { data: session } = useSession();
  const allowed = session ? canEnter(area, session) : false;

  useEffect(() => {
    if (session && !allowed) router.replace(homePath(session));
  }, [session, allowed, router]);

  return allowed ? children : null;
}
