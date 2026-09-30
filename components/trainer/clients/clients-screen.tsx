"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import type { ClientTrackingFilter } from "@/lib/data/ports";
import { useClientsTracking, useTrainer } from "@/lib/data/hooks";
import { todayCivil } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import { ClientRow, ROW_GRID } from "./client-row";

const t = es.screensClients;

const FILTERS: ClientTrackingFilter[] = ["todos", "activo", "invitado", "dado_de_baja"];

/** Filas por página, paginadas en el servidor. */
const PAGE_SIZE = 10;

/**
 * Seguimiento de clientes (`/clients`): la cartera del entrenador de un vistazo. Cada fila lleva
 * al detalle del cliente y el botón de la cabecera al alta. Filtra, busca y pagina el servidor:
 * la pantalla solo pide la página que enseña. Las revisiones nuevas van primero.
 */
export function ClientsScreen() {
  const trainer = useTrainer();
  const [filter, setFilter] = useState<ClientTrackingFilter>("todos");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const tracking = useClientsTracking({
    filter,
    search,
    today: todayCivil(trainer.data?.timeZone),
    page,
    pageSize: PAGE_SIZE,
  });
  const data = tracking.data;
  const timeZone = trainer.data?.timeZone;

  // Cambiar el corte vuelve a la primera página: la actual puede no existir en el nuevo.
  const change = (apply: () => void) => {
    apply();
    setPage(0);
  };

  const total = data?.counts[filter] ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const neverAny = data !== undefined && data.counts.todos === 0 && search.trim() === "";

  let body;
  if (tracking.isError || trainer.isError) {
    body = (
      <ErrorState
        onRetry={() => {
          void tracking.refetch();
          void trainer.refetch();
        }}
      />
    );
  } else if (!data || !timeZone) {
    body = <LoadingState />;
  } else if (neverAny) {
    body = (
      <EmptyState
        title={t.empty.title}
        description={t.empty.hint}
        action={
          <Button asChild variant="outline">
            <Link href="/clients/new">{es.actions.newClient}</Link>
          </Button>
        }
      />
    );
  } else {
    body = (
      <>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="group" aria-label={t.filters.label} className="flex flex-wrap gap-2">
            {FILTERS.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => change(() => setFilter(key))}
                className={cn(
                  "focus-visible:ring-ring/50 h-10 rounded-md border px-3.5 text-[13px] transition-colors outline-none focus-visible:ring-[3px]",
                  filter === key
                    ? "border-border-strong bg-surface-overlay text-text-primary"
                    : "border-border-emphasis text-text-muted hover:text-text-primary",
                )}
              >
                {t.filters[key]} · {data.counts[key]}
              </button>
            ))}
          </div>
          <Input
            type="search"
            aria-label={t.search.label}
            placeholder={t.search.placeholder}
            value={search}
            onChange={(e) => change(() => setSearch(e.target.value))}
            className="h-10 sm:max-w-[260px]"
          />
        </div>

        {data.rows.length === 0 ? (
          <EmptyState title={t.noMatches.title} description={t.noMatches.hint} />
        ) : (
          <Card className="gap-0 px-0 py-2">
            <div
              className={cn(
                ROW_GRID,
                "border-border-subtle tracking-label text-text-subtle hidden h-10 items-center border-b px-5 text-[12px] uppercase lg:grid",
              )}
            >
              <span>{t.columns.client}</span>
              <span>{t.columns.plan}</span>
              <span>{t.columns.week}</span>
              <span>{t.columns.review}</span>
              <span>{t.columns.membership}</span>
              <span>{t.columns.status}</span>
            </div>
            <ul>
              {data.rows.map((row) => (
                <ClientRow key={row.client.id} row={row} timeZone={timeZone} />
              ))}
            </ul>
          </Card>
        )}

        {pages > 1 ? (
          <nav aria-label={t.pagination.label} className="flex items-center justify-between gap-4">
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
                onClick={() => setPage(page - 1)}
              >
                {t.pagination.previous}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= pages - 1}
                onClick={() => setPage(page + 1)}
              >
                {t.pagination.next}
              </Button>
            </div>
          </nav>
        ) : null}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t.eyebrow}
        title={es.pages.trainer.clientes}
        actions={
          <Button asChild>
            <Link href="/clients/new">+ {es.actions.newClient}</Link>
          </Button>
        }
      />
      {body}
    </div>
  );
}
