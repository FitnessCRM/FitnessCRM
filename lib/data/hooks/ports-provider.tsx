"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { DataPorts } from "@/lib/data/ports";

const PortsContext = createContext<DataPorts | null>(null);

/**
 * Único punto donde la app recibe una implementación de los puertos. Los hooks leen de aquí;
 * los componentes nunca importan un adaptador.
 */
export function PortsProvider({ ports, children }: { ports: DataPorts; children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <PortsContext.Provider value={ports}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </PortsContext.Provider>
  );
}

export function usePorts(): DataPorts {
  const ports = useContext(PortsContext);
  if (!ports) throw new Error("usePorts() requiere un <PortsProvider> por encima");
  return ports;
}
