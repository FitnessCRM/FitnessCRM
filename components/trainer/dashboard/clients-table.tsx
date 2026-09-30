"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import type { Client } from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { cn, initialsOf } from "@/lib/utils";

const t = es.components.dashboard;

export function ClientsTable({ clients }: { clients: Client[] }) {
  const [tab, setTab] = useState<"active" | "inactive">("active");

  const activeClients = useMemo(() => clients.filter((c) => c.status === "activo"), [clients]);
  const inactiveClients = useMemo(() => clients.filter((c) => c.status !== "activo"), [clients]);

  const displayed = tab === "active" ? activeClients : inactiveClients;

  return (
    <div className="border-border bg-surface flex flex-col gap-4 rounded-lg border p-6">
      <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "inactive")}>
        <TabsList className="mb-4 flex w-full">
          <TabsTrigger value="active" className="flex-1">
            {t.activeTabLabel} {activeClients.length}
          </TabsTrigger>
          <TabsTrigger value="inactive" className="flex-1">
            {t.inactiveTabLabel} {inactiveClients.length}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="m-0">
          <Table clients={activeClients} />
        </TabsContent>
        <TabsContent value="inactive" className="m-0">
          <Table clients={inactiveClients} />
        </TabsContent>
      </Tabs>
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
          href={`/clientes/${client.id}`}
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
