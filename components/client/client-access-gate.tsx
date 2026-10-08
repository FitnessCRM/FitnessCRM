"use client";

import type { ReactNode } from "react";
import { ErrorState, EmptyState, LoadingState } from "@/components/ui/states";
import { useClient, useSessionClientId } from "@/lib/data/hooks";
import { es } from "@/lib/i18n/es";

const t = es.clientAccess.discharged;

/**
 * Un cliente dado de baja no tiene acceso a la app (docs/dominio.md §7). Mientras se lee su ficha no
 * se pinta nada, y si está de baja solo se ve el aviso: el área no se monta, así que ninguna de sus
 * consultas se lanza. La ficha propia es lo único que las reglas dejan leer a una cuenta de baja.
 */
export function ClientAccessGate({ children }: { children: ReactNode }) {
  const clientId = useSessionClientId();
  const client = useClient(clientId);

  if (client.isError) return <ErrorState onRetry={() => void client.refetch()} />;
  if (client.data === undefined) return <LoadingState />;
  if (client.data?.status === "dado_de_baja") {
    return <EmptyState title={t.title} description={t.hint} />;
  }
  return <>{children}</>;
}
