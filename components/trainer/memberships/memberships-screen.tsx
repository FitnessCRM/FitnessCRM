"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EXPIRING_SOON_DAYS, type MembershipStatusFilter } from "@/lib/domain";
import {
  useClients,
  useMembershipsWithClients,
  useSaveMembership,
  useTrainer,
} from "@/lib/data/hooks";
import { todayCivil } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import { MembershipRow } from "./membership-row";

const t = es.screensTrainerMemberships;

/** Filas por página, paginadas en el servidor. */
const PAGE_SIZE = 50;

/**
 * Pantalla 17 · Membresías. Una fila por membresía —las renovaciones son filas nuevas (§7)—,
 * acotable por cliente y por estado, con edición en línea de tipo, fechas y estado de pago (I21).
 * Filtra y pagina el servidor: la pantalla solo pide la página que enseña.
 */
export function MembershipsScreen() {
  const trainer = useTrainer();
  const today = todayCivil(trainer.data?.timeZone);
  const clients = useClients();
  const save = useSaveMembership();
  const [filter, setFilter] = useState<MembershipStatusFilter>("all");
  const [clientId, setClientId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);

  const memberships = useMembershipsWithClients({
    clientId: clientId ?? undefined,
    filter,
    today,
    page,
    pageSize: PAGE_SIZE,
  });
  const data = memberships.data;

  // Cambiar el corte vuelve a la primera página: la actual puede no existir en el nuevo.
  const change = (apply: () => void) => {
    apply();
    setPage(0);
    setEditingId(null);
  };

  const goTo = (next: number) => {
    setPage(next);
    setEditingId(null);
  };

  const chips: { key: MembershipStatusFilter; label: string; hint?: string }[] = [
    { key: "all", label: t.filters.all },
    { key: "unpaid", label: t.filters.unpaid },
    {
      key: "expiring",
      label: t.filters.expiring,
      hint: t.filters.expiringHint.replace("{days}", String(EXPIRING_SOON_DAYS)),
    },
  ];
  const total = data?.counts[filter] ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const neverAny = data !== undefined && data.counts.all === 0 && clientId === null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t.eyebrow}
        title={es.pages.trainer.membresias}
        actions={
          data && !neverAny ? (
            <div role="group" aria-label={t.filters.label} className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <FilterChip
                  key={chip.key}
                  label={`${chip.label} · ${data.counts[chip.key]}`}
                  hint={chip.hint}
                  tone={chip.key === "unpaid" ? "danger" : "neutral"}
                  active={filter === chip.key}
                  onClick={() => change(() => setFilter(chip.key))}
                />
              ))}
            </div>
          ) : null
        }
      />

      {memberships.isPending ? (
        <LoadingState />
      ) : memberships.isError || !data ? (
        <ErrorState onRetry={() => void memberships.refetch()} />
      ) : neverAny ? (
        <EmptyState title={t.empty.title} description={t.empty.hint} />
      ) : (
        <>
          <Combobox
            className="w-full max-w-[280px]"
            label={t.filters.client}
            placeholder={t.filters.clientPlaceholder}
            allLabel={t.filters.allClients}
            emptyLabel={t.filters.noClients}
            value={clientId}
            options={(clients.data ?? []).map((c) => ({
              value: c.id,
              label: `${c.firstName} ${c.lastName}`,
            }))}
            onChange={(value) => change(() => setClientId(value))}
          />

          {data.rows.length === 0 ? (
            <EmptyState title={t.noMatches.title} description={t.noMatches.hint} />
          ) : (
            <Card className="gap-0 px-0 py-2">
              <Table>
                <TableHeader>
                  <TableRow className="border-border-subtle hover:bg-transparent">
                    <TableHead className="pl-5">{t.columns.client}</TableHead>
                    <TableHead>{t.columns.type}</TableHead>
                    <TableHead>{t.columns.start}</TableHead>
                    <TableHead>{t.columns.end}</TableHead>
                    <TableHead>{t.columns.status}</TableHead>
                    <TableHead className="pr-5">
                      <span className="sr-only">{t.actions.edit}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row) => (
                    <MembershipRow
                      key={row.membership.id}
                      row={row}
                      overlapping={data.overlappingIds.includes(row.membership.id)}
                      editing={editingId === row.membership.id}
                      isSaving={save.isPending}
                      saveError={save.isError && editingId === row.membership.id}
                      onEdit={() => {
                        save.reset();
                        setEditingId(row.membership.id);
                      }}
                      onCancel={() => setEditingId(null)}
                      onSave={async (changes) => {
                        await save.mutateAsync({ membershipId: row.membership.id, changes });
                        setEditingId(null);
                      }}
                    />
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {pages > 1 ? (
            <nav
              aria-label={t.pagination.label}
              className="flex items-center justify-between gap-4"
            >
              <p className="text-text-subtle text-[13px]" aria-live="polite">
                {t.pagination.summary
                  .replace("{page}", String(page + 1))
                  .replace("{pages}", String(pages))
                  .replace("{total}", String(total))}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => goTo(page - 1)}
                >
                  {t.pagination.previous}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= pages - 1}
                  onClick={() => goTo(page + 1)}
                >
                  {t.pagination.next}
                </Button>
              </div>
            </nav>
          ) : null}
          <p className="text-text-subtle text-[13px]">{t.legend}</p>
        </>
      )}
    </div>
  );
}

function FilterChip({
  label,
  hint,
  tone,
  active,
  onClick,
}: {
  label: string;
  hint?: string;
  tone: "neutral" | "danger";
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={hint}
      onClick={onClick}
      className={cn(
        "focus-visible:ring-ring/50 h-10 rounded-md border px-3.5 text-[13px] transition-colors outline-none focus-visible:ring-[3px]",
        active
          ? tone === "danger"
            ? "border-danger/55 bg-danger-soft text-danger"
            : "border-border-strong bg-surface-overlay text-text-primary"
          : tone === "danger"
            ? "border-danger/35 text-danger hover:bg-danger-soft"
            : "border-border-emphasis text-text-muted hover:text-text-primary",
      )}
    >
      {label}
    </button>
  );
}
