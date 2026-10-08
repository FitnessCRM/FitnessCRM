"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FoodOriginBadges } from "@/components/ui/food-origin-badges";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import type { LibraryFood } from "@/lib/domain";
import type { FoodCatalogMore, FoodCatalogStatus } from "@/lib/data/hooks";
import { formatInteger, formatNumber } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.screensLibrary.foods;
const f = t.form;

/** Nombre y cuatro cifras por 100 g. En móvil las cifras se estrechan y el nombre se parte. */
const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_repeat(4,64px)] gap-2 px-4 max-sm:grid-cols-[minmax(0,1fr)_repeat(4,42px)] max-sm:gap-1 max-sm:px-2.5";

/**
 * Lista de la pestaña Alimentos: los tuyos y, aparte, lo que llega del catálogo común (§4). Cada
 * grupo con su propio estado: que el catálogo no responda no toca la lista de los tuyos.
 */
export function FoodTable({
  own,
  ownTotal,
  catalog,
  selectedId,
  onSelect,
}: {
  /** Los tuyos que coinciden con el texto, ya ordenados. */
  own: LibraryFood[];
  /** Cuántos tienes en total, para distinguir «no tienes» de «no coincide». */
  ownTotal: number;
  catalog: CatalogGroupProps | null;
  selectedId: string | undefined;
  onSelect: (food: LibraryFood) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-text-subtle text-xs">{t.legend}</p>
      <div className="border-border-subtle bg-surface overflow-hidden rounded-[10px] border">
        <div
          aria-hidden
          className={cn(
            ROW_GRID,
            "border-border-subtle text-text-subtle tracking-label h-9 items-center border-b text-[11px] uppercase",
          )}
        >
          <span>{t.columns.name}</span>
          <span className="text-right">{t.columns.kcal}</span>
          <span className="text-right">{t.columns.protein}</span>
          <span className="text-right">{t.columns.carbs}</span>
          <span className="text-right">{t.columns.fat}</span>
        </div>

        <Group title={t.groups.own}>
          {ownTotal === 0 ? (
            <EmptyState title={t.ownEmpty.title} description={t.ownEmpty.hint} className="m-3" />
          ) : own.length === 0 ? (
            <GroupNote>{t.ownNoMatches}</GroupNote>
          ) : (
            <Rows foods={own} selectedId={selectedId} onSelect={onSelect} />
          )}
        </Group>

        {catalog ? (
          <Group title={t.groups.catalog}>
            <CatalogGroup {...catalog} selectedId={selectedId} onSelect={onSelect} />
          </Group>
        ) : null}
      </div>
    </div>
  );
}

export interface CatalogGroupProps {
  /** `null` con el buscador vacío: el catálogo se busca, no se lista (§4). */
  status: FoodCatalogStatus;
  foods: LibraryFood[];
  more: FoodCatalogMore;
  onRetry: () => void;
}

function CatalogGroup({
  status,
  foods,
  more,
  onRetry,
  selectedId,
  onSelect,
}: CatalogGroupProps & {
  selectedId: string | undefined;
  onSelect: (food: LibraryFood) => void;
}) {
  const c = t.catalog;
  if (status === null) return <GroupNote>{c.typeToSearch}</GroupNote>;
  if (status === "loading") return <LoadingState label={c.loading} className="px-4 py-4" />;
  if (status === "unavailable")
    return (
      <p
        role="status"
        className="border-border-subtle bg-surface-raised text-text-muted m-3 rounded-lg border px-4 py-3 text-sm"
      >
        {c.unavailable}
      </p>
    );
  if (status === "error") return <ErrorState message={c.error} onRetry={onRetry} className="m-3" />;

  return (
    <>
      {foods.length === 0 ? (
        <GroupNote>{c.noMatches}</GroupNote>
      ) : (
        <Rows foods={foods} selectedId={selectedId} onSelect={onSelect} />
      )}
      {more.error ? (
        <ErrorState message={c.moreError} onRetry={more.loadMore} className="m-3" />
      ) : null}
      {more.hasMore ? (
        <div className="border-border-subtle border-t p-3">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={more.loadMore}
            disabled={more.isLoadingMore}
          >
            {more.isLoadingMore ? c.loadingMore : c.more}
          </Button>
        </div>
      ) : null}
    </>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-border-subtle border-b last:border-b-0">
      <h2 className="font-display tracking-label bg-surface-raised text-text-muted px-4 py-2 text-[12px] uppercase max-sm:px-2.5">
        {title}
      </h2>
      {children}
    </section>
  );
}

function GroupNote({ children }: { children: ReactNode }) {
  return <p className="text-text-subtle px-4 py-4 text-sm max-sm:px-2.5">{children}</p>;
}

function Rows({
  foods,
  selectedId,
  onSelect,
}: {
  foods: LibraryFood[];
  selectedId: string | undefined;
  onSelect: (food: LibraryFood) => void;
}) {
  return (
    <ul>
      {foods.map((food) => {
        const selected = food.id === selectedId;
        const c = food.composition;
        return (
          <li key={food.id} className="border-border-subtle border-t first:border-t-0">
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(food)}
              className={cn(
                ROW_GRID,
                "focus-visible:ring-ring/50 min-h-12 w-full items-center border-l-[3px] py-2 text-left text-[14px] tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-inset max-sm:text-[13px]",
                selected
                  ? "border-l-accent bg-accent-soft"
                  : "hover:bg-surface-raised border-l-transparent",
              )}
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-text-primary font-semibold [overflow-wrap:anywhere]">
                  {food.name}
                </span>
                <FoodOriginBadges food={food} />
              </span>
              <Cell label={f.kcal} value={formatInteger(c.kcal)} strong />
              <Cell label={f.protein} value={formatNumber(c.proteinG)} />
              <Cell label={f.carbs} value={formatNumber(c.carbsG)} />
              <Cell label={f.fat} value={formatNumber(c.fatG)} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Una cifra de la fila. La cabecera de columnas es visual: el nombre de la cifra va aquí, oculto. */
function Cell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <span className={cn("text-right", strong ? "text-text-primary" : "text-text-muted")}>
      <span className="sr-only">{label} </span>
      {value}
    </span>
  );
}
