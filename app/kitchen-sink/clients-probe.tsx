"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useClients } from "@/lib/data/hooks";
import { es } from "@/lib/i18n/es";

const t = es.dev.clientsProbe;

/** Prueba de la capa de datos: carga, error y lista. No conoce el adaptador. */
export function ClientsProbe() {
  const clients = useClients();

  if (clients.isPending) {
    return <p className="text-text-muted text-sm">{t.loading}</p>;
  }

  if (clients.isError) {
    return (
      <div role="alert" className="flex items-center gap-3">
        <p className="text-danger text-sm">{t.error}</p>
        <Button variant="outline" size="sm" onClick={() => clients.refetch()}>
          {t.retry}
        </Button>
      </div>
    );
  }

  if (clients.data.length === 0) {
    return <p className="text-text-muted text-sm">{t.empty}</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-text-subtle text-xs">{t.hint}</p>
      <ul className="divide-border-subtle border-border-subtle divide-y rounded-lg border">
        {clients.data.map((client) => (
          <li key={client.id} className="flex items-center justify-between px-4 py-2.5">
            <span className="font-semibold">
              {client.firstName} {client.lastName}
            </span>
            <Badge variant={client.status === "activo" ? "success" : "outline"}>
              {t.status[client.status]}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
