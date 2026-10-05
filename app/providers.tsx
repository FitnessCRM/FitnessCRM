"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createMockPorts } from "@/lib/data/adapters/mock";
import { PortsProvider } from "@/lib/data/hooks";
import type { DataPorts } from "@/lib/data/ports";

/**
 * `NEXT_PUBLIC_DATA_BACKEND=firebase` activa el adaptador de Firebase; sin ella, o con cualquier
 * otro valor, la app sigue con el adaptador en memoria y los datos de la demo. Se lee como literal
 * porque Next solo sustituye `process.env.NEXT_PUBLIC_*` escrito tal cual.
 */
const usesFirebase = process.env.NEXT_PUBLIC_DATA_BACKEND === "firebase";

/**
 * Raíz de composición: el ÚNICO sitio de la app que elige un adaptador. Ningún componente se
 * entera de cuál hay detrás. El de Firebase se importa en diferido, así que sin la variable el SDK
 * ni se descarga; mientras carga no se pinta nada, porque sin puertos no hay datos que enseñar.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [ports, setPorts] = useState<DataPorts | null>(() =>
    usesFirebase ? null : createMockPorts(),
  );

  useEffect(() => {
    if (!usesFirebase) return;
    let cancelled = false;
    void import("@/lib/data/adapters/firebase/ports").then((m) => {
      if (!cancelled) setPorts(m.createFirebasePortsFromEnv());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ports) return null;
  return <PortsProvider ports={ports}>{children}</PortsProvider>;
}
