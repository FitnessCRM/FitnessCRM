"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { Button } from "@/components/ui/button";
import type { Client } from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { cn, initialsOf } from "@/lib/utils";

const t = es.components.dashboard;

export function ClientsTable({
  clients,
  filter,
  onFilterChange,
  page,
  total,
  pageSize,
  onPageChange,
  counts,
}: {
  clients: Client[];
  filter: "activo" | "inactivo" | "todos";
  onFilterChange: (f: "activo" | "inactivo" | "todos") => void;
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  counts: Record<"activo" | "inactivo" | "todos", number>;
}) {
  const totalPages = Math.ceil(total / pageSize);

  const handleTabChange = (value: string) => {
    onFilterChange(value as "activo" | "inactivo" | "todos");
  };

  return (
    <div className="border-border bg-surface flex flex-col gap-4 rounded-lg border p-6">
      <Tabs value={filter} onValueChange={handleTabChange}>
        <TabsList className="mb-4 flex w-full">
          <TabsTrigger value="activo" className="flex-1">
            {t.activeTabLabel} {counts.activo}
          </TabsTrigger>
          <TabsTrigger value="inactivo" className="flex-1">
            {t.inactiveTabLabel} {counts.inactivo}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activo" className="m-0">
          <Table clients={clients} />
        </TabsContent>
        <TabsContent value="inactivo" className="m-0">
          <Table clients={clients} />
        </TabsContent>
      </Tabs>

      {totalPages > 1 && (
        <div className="border-border-emphasis mt-4 flex items-center justify-between gap-2 border-t pt-4">
          <span className="text-text-muted text-xs">
            Página {page + 1} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page === 0}
              onClick={() => onPageChange(page - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page === totalPages - 1}
              onClick={() => onPageChange(page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Table({ clients }: { clients: Client[] }) {
  if (clients.length === 0) {
    return <p className="text-text-muted text-sm">{t.noClients}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border-emphasis text-text-muted border-b text-xs tracking-wider uppercase">
            <th className="px-3 py-2 text-left font-medium">{t.clientCol}</th>
            <th className="px-3 py-2 text-left font-medium">{t.blockCol}</th>
            <th className="px-3 py-2 text-left font-medium">{t.lastReviewCol}</th>
            <th className="px-3 py-2 text-left font-medium">{t.statusCol}</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <ClientRow key={client.id} client={client} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClientRow({ client }: { client: Client }) {
  const statusLabel = es.status.client[client.status];
  const statusColor =
    client.status === "activo"
      ? "text-success"
      : client.status === "invitado"
        ? "text-text-muted"
        : "text-text-disabled";

  return (
    <tr className="border-border-emphasis hover:bg-surface-raised border-b transition-colors">
      <td className="px-3 py-3">
        <Link
          href={`/clients/${client.id}`}
          className="text-text-primary flex items-center gap-2 hover:underline"
        >
          <InitialsAvatar initials={initialsOf(client.firstName, client.lastName)} />
          <span className="font-medium">
            {client.firstName} {client.lastName}
          </span>
        </Link>
      </td>
      <td className="text-text-muted px-3 py-3">—</td>
      <td className="text-text-muted px-3 py-3">Hoy</td>
      <td className={cn("px-3 py-3 font-medium", statusColor)}>{statusLabel}</td>
    </tr>
  );
}
