"use client";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { DataPorts } from "@/lib/data/ports";
import { registerOfflineWrites } from "./offline-writes";
import { createIdbPersister, PERSIST_MAX_AGE_MS, shouldPersistQuery } from "./query-persister";

const PortsContext = createContext<DataPorts | null>(null);

/**
 * Cambia con cada compilación: una caché guardada por una versión anterior puede tener otra forma
 * de datos, y es más barato volver a pedirla que leerla mal.
 */
const CACHE_BUSTER = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

/**
 * Único punto donde la app recibe una implementación de los puertos. Los hooks leen de aquí;
 * los componentes nunca importan un adaptador. La caché de las consultas se guarda en el
 * dispositivo para poder leer sin conexión (`networkMode: "offlineFirst"`: se intenta la
 * petición, pero un fallo de red no vacía lo que ya hay).
 */
export function PortsProvider({ ports, children }: { ports: DataPorts; children: ReactNode }) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          gcTime: PERSIST_MAX_AGE_MS,
          retry: 1,
          refetchOnWindowFocus: false,
          networkMode: "offlineFirst",
        },
      },
    });
    // Antes de restaurar la caché: una mutación guardada en disco solo sabe su clave.
    registerOfflineWrites(client, ports);
    return client;
  });
  const [persister] = useState(createIdbPersister);
  return (
    <PortsContext.Provider value={ports}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: PERSIST_MAX_AGE_MS,
          buster: CACHE_BUSTER,
          dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
        }}
        onSuccess={() => {
          void queryClient.resumePausedMutations();
        }}
      >
        {children}
      </PersistQueryClientProvider>
    </PortsContext.Provider>
  );
}

export function usePorts(): DataPorts {
  const ports = useContext(PortsContext);
  if (!ports) throw new Error("usePorts() requiere un <PortsProvider> por encima");
  return ports;
}
