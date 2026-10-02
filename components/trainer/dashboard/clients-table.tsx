"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { Button } from "@/components/ui/button";
import type { ClientTrackingFilter, ClientTrackingRow } from "@/lib/data/ports";
import type { CivilDate, ClientStatus } from "@/lib/domain";
import { civilDateOf, formatShortDate } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn, initialsOf } from "@/lib/utils";

const t = es.components.dashboard;

/** Tres pestañas, una por estado del cliente (§7): «inactivo» no existe. */
export function ClientsTable({
  rows,
  filter,
  onFilterChange,
  page,
  pageSize,
  onPageChange,
  counts,
  today,
  timeZone,
}: {
  rows: ClientTrackingRow[];
  filter: ClientStatus;
  onFilterChange: (f: ClientStatus) => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  counts: Record<ClientTrackingFilter, number>;
  today: CivilDate;
  timeZone: string;
}) {
  const totalPages = Math.ceil(counts[filter] / pageSize);

  return (
    <div className="border-border bg-surface flex flex-col gap-4 rounded-lg border p-6">
      <Tabs value={filter} onValueChange={(value) => onFilterChange(value as ClientStatus)}>
        {/* Tres etiquetas largas: en móvil la lista se parte en dos líneas en vez de desbordar. */}
        <TabsList className="mb-4 flex w-full flex-wrap" aria-label={t.tabsLabel}>
          {STATUS_ORDER.map((status) => (
            <TabsTrigger
              key={status}
              value={status}
              className="flex-1 whitespace-nowrap max-sm:px-3"
            >
              {es.status.client[status]} {counts[status]}
            </TabsTrigger>
          ))}
        </TabsList>

        {STATUS_ORDER.map((status) => (
          <TabsContent key={status} value={status} className="m-0">
            <Table rows={rows} today={today} timeZone={timeZone} />
          </TabsContent>
        ))}
      </Tabs>

      {totalPages > 1 && (
        <div className="border-border-emphasis mt-4 flex items-center justify-between gap-2 border-t pt-4">
          <span className="text-text-muted text-xs">
            {t.pagination.summary
              .replace("{page}", String(page + 1))
              .replace("{pages}", String(totalPages))}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page === 0}
              onClick={() => onPageChange(page - 1)}
            >
              {t.pagination.previous}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page === totalPages - 1}
              onClick={() => onPageChange(page + 1)}
            >
              {t.pagination.next}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** En activo · Invitación pendiente · Baja. La primera es la que se abre. */
const STATUS_ORDER: readonly ClientStatus[] = ["activo", "invitado", "dado_de_baja"];

function Table({
  rows,
  today,
  timeZone,
}: {
  rows: ClientTrackingRow[];
  today: CivilDate;
  timeZone: string;
}) {
  if (rows.length === 0) {
    return <p className="text-text-muted text-sm">{t.noClients}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border-emphasis text-text-muted border-b text-xs tracking-wider uppercase">
            <th className="px-3 py-2 text-left font-medium">{t.clientCol}</th>
            <th className="px-3 py-2 text-left font-medium">{t.lastReviewCol}</th>
            <th className="px-3 py-2 text-left font-medium">{t.statusCol}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <ClientRow key={row.client.id} row={row} today={today} timeZone={timeZone} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClientRow({
  row,
  today,
  timeZone,
}: {
  row: ClientTrackingRow;
  today: CivilDate;
  timeZone: string;
}) {
  const { client, lastReviewAt } = row;
  const statusColor =
    client.status === "activo"
      ? "text-success"
      : client.status === "invitado"
        ? "text-text-muted"
        : "text-text-disabled";
  // La última revisión enviada, en la zona del entrenador (no en UTC).
  const lastReview = lastReviewAt ? civilDateOf(lastReviewAt, timeZone) : null;

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
      <td className="text-text-muted px-3 py-3">
        {lastReview ? (
          <time dateTime={lastReview}>{formatShortDate(lastReview, today)}</time>
        ) : (
          es.common.none
        )}
      </td>
      <td className={cn("px-3 py-3 font-medium", statusColor)}>
        {es.status.client[client.status]}
      </td>
    </tr>
  );
}
