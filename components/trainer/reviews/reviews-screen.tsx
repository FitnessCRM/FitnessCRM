"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import type { ReviewTrackingFilter } from "@/lib/data/ports";
import { useReviewsTracking, useTrainer } from "@/lib/data/hooks";
import { todayCivil } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import { ROW_GRID, ReviewRow } from "./review-row";

const t = es.screensReviews;

const FILTERS: ReviewTrackingFilter[] = ["todas", "enviada", "vista", "revisada"];

/** Filas por página, paginadas en el servidor. */
const PAGE_SIZE = 10;

/**
 * Revisiones recibidas (`/reviews`): todas las revisiones que han enviado los clientes, con las
 * nuevas primero. Pantalla sin captura de diseño: parte de Seguimiento de clientes (mismos
 * chips, buscador, tarjeta de filas y paginación). Cada fila lleva a la revisión del cliente.
 */
export function ReviewsScreen() {
  const trainer = useTrainer();
  const [filter, setFilter] = useState<ReviewTrackingFilter>("todas");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const tracking = useReviewsTracking({ filter, search, page, pageSize: PAGE_SIZE });
  const data = tracking.data;
  const timeZone = trainer.data?.timeZone;

  // Cambiar el corte vuelve a la primera página: la actual puede no existir en el nuevo.
  const change = (apply: () => void) => {
    apply();
    setPage(0);
  };

  const total = data?.counts[filter] ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const neverAny = data !== undefined && data.counts.todas === 0 && search.trim() === "";

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
    body = <EmptyState title={t.empty.title} description={t.empty.hint} />;
  } else {
    const today = todayCivil(timeZone);
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
              <span>{t.columns.week}</span>
              <span>{t.columns.sent}</span>
              <span>{t.columns.status}</span>
              <span>{t.columns.content}</span>
            </div>
            <ul>
              {data.rows.map((row) => (
                <ReviewRow key={row.review.id} row={row} today={today} />
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
      <PageHeader eyebrow={t.eyebrow} title={es.pages.trainer.revisiones} />
      {body}
    </div>
  );
}
