"use client";

import { useState, type ReactNode } from "react";
import { createMockPorts } from "@/lib/data/adapters/mock";
import { PortsProvider } from "@/lib/data/hooks";

/**
 * Raíz de composición: el ÚNICO sitio de la app que elige un adaptador.
 * Cuando haya backend, esta línea cambia y ningún componente se entera.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [ports] = useState(() => createMockPorts());
  return <PortsProvider ports={ports}>{children}</PortsProvider>;
}
