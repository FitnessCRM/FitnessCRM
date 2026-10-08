"use client";

import { XIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";
import { useDebouncedValue } from "@/components/ui/use-debounced-value";
import { useMediaQuery, XL_MEDIA_QUERY } from "@/components/ui/use-media-query";
import type { FoodDraft, LibraryFood } from "@/lib/domain";
import { useArchiveFood, useFoods, useSaveFood } from "@/lib/data/hooks";
import { formatNumber } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { FoodArchiveDialog } from "./food-archive-dialog";
import { FoodForm, type FoodFormValues } from "@/components/editor/food-form";
import { FoodTable } from "./food-table";
import { LibraryHeader, LibraryPanel } from "./library-header";

const t = es.screensLibrary.foods;

/** Espera entre teclas antes de buscar: cada texto es una búsqueda nueva en el catálogo. */
const SEARCH_DEBOUNCE_MS = 300;

const MACROS = ["proteinG", "carbsG", "fatG"] as const;

/** `null`: nada elegido; `new`: alimento nuevo; si no, el alimento abierto en el panel. */
type Selection = { kind: "new" } | { kind: "food"; food: LibraryFood } | null;

const byName = (a: LibraryFood, b: LibraryFood) => a.name.localeCompare(b.name, "es");

/**
 * Pestaña Alimentos de la Biblioteca (§4). Los tuyos se listan enteros y por nombre; el catálogo
 * común solo se busca, con texto, y llega por páginas en su orden. Desde `xl`, el panel del alimento
 * va a la derecha; por debajo, en un `Sheet`, porque un formulario no es ni contexto que leer antes
 * ni resumen de lo leído (regla de la columna lateral de `CLAUDE.md`).
 */
export function FoodsLibrary() {
  const [search, setSearch] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const text = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS, (value) => value === "");

  // Sin texto no se busca en el catálogo: se busca, no se lista (§4).
  const library = useFoods({ text, onlyMine: onlyMine || text === "" });
  // Todos los tuyos, para el recuento. Comparte la consulta de la copia propia con la de arriba.
  const allOwn = useFoods({ onlyMine: true });

  const [selection, setSelection] = useState<Selection>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const saveFood = useSaveFood();
  const archiveFood = useArchiveFood();
  const wide = useMediaQuery(XL_MEDIA_QUERY);

  const ownTotal = allOwn.foods?.length ?? 0;
  const header = (
    <LibraryHeader
      action={<Button onClick={() => select({ kind: "new" })}>{t.newFood}</Button>}
      count={
        allOwn.foods ? `${ownTotal} ${ownTotal === 1 ? t.count.one : t.count.other}` : undefined
      }
    />
  );

  function select(next: Selection) {
    setSelection(next);
    setNotice(null);
    setConfirming(false);
    saveFood.reset();
  }

  if (library.isPending)
    return (
      <>
        {header}
        <LibraryPanel tab="foods">
          <LoadingState />
        </LibraryPanel>
      </>
    );
  if (library.isError || !library.foods)
    return (
      <>
        {header}
        <LibraryPanel tab="foods">
          <ErrorState onRetry={() => void library.refetch()} />
        </LibraryPanel>
      </>
    );

  const foods = library.foods;
  const own = foods.filter((food) => food.origin === "own").sort(byName);
  const fromCatalog = foods.filter((food) => food.origin !== "own");

  // Lo tuyo se lee de la lista, que es lo último guardado; lo demás, de la foto que se eligió,
  // para que no se cierre si cambia la búsqueda.
  const selected =
    selection?.kind === "food"
      ? selection.food.origin === "own"
        ? (allOwn.foods?.find((food) => food.id === selection.food.id) ?? selection.food)
        : selection.food
      : null;

  const save = async (draft: FoodDraft, typed: FoodFormValues) => {
    const foodId = selected?.origin === "own" ? selected.id : undefined;
    // Si falla, lo dice el panel (`saveFood.isError`).
    const result = await saveFood.mutateAsync({ foodId, draft }).catch(() => null);
    if (!result) return;
    setSelection({ kind: "food", food: { ...result.food, origin: "own" } });
    setNotice(savedNotice(result.food.composition, typed, result.published));
  };

  const panel =
    selection === null ? null : (
      <FoodForm
        key={
          selected ? `${selected.id}:${"updatedAt" in selected ? selected.updatedAt : ""}` : "new"
        }
        food={selected}
        title={(heading) =>
          wide ? (
            <h2 className="section-title">{heading}</h2>
          ) : (
            <SheetTitle className="section-title">{heading}</SheetTitle>
          )
        }
        isSaving={saveFood.isPending}
        saveError={saveFood.isError}
        onSubmit={save}
        onEdit={() => setNotice(null)}
        onDelete={() => setConfirming(true)}
        onClose={() => select(null)}
      />
    );
  const status = (
    <p role="status" className="text-success text-sm">
      {notice}
    </p>
  );

  return (
    <>
      {header}
      <LibraryPanel
        tab="foods"
        className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_380px]"
      >
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t.search}
              aria-label={t.search}
              className="h-10 min-w-0 flex-1 basis-[220px] sm:max-w-[380px]"
            />
            <label className="text-text-muted flex min-h-10 cursor-pointer items-center gap-2.5 text-[13px]">
              <Switch checked={onlyMine} onCheckedChange={setOnlyMine} aria-label={t.onlyMine} />
              {t.onlyMine}
            </label>
          </div>

          <FoodTable
            own={own}
            ownTotal={ownTotal}
            catalog={
              onlyMine
                ? null
                : {
                    status: library.catalog,
                    foods: fromCatalog,
                    more: library.catalogMore,
                    onRetry: library.retryCatalog,
                  }
            }
            selectedId={selected?.id}
            onSelect={(food) => select({ kind: "food", food })}
          />
        </div>

        {wide ? (
          <div className="flex flex-col gap-3">
            {panel ? (
              <Card className="gap-4 px-[22px] py-[22px]">
                {panel}
                {status}
              </Card>
            ) : (
              <EmptyState title={t.panel.pickTitle} description={t.panel.pickHint} />
            )}
          </div>
        ) : (
          <Sheet open={panel !== null} onOpenChange={(open) => (open ? null : select(null))}>
            <SheetContent
              side="right"
              aria-describedby={undefined}
              className="bg-surface w-full max-w-full gap-4 overflow-y-auto px-4 py-5 sm:w-[420px] sm:max-w-[420px] sm:px-6"
            >
              <SheetClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={es.common.close}
                  className="self-end"
                >
                  <XIcon />
                </Button>
              </SheetClose>
              {panel}
              {status}
            </SheetContent>
          </Sheet>
        )}
      </LibraryPanel>

      {confirming && selected?.origin === "own" ? (
        <FoodArchiveDialog
          name={selected.name}
          isWorking={archiveFood.isPending}
          hasError={archiveFood.isError}
          onConfirm={async () => {
            // Si falla, lo dice el diálogo (`archiveFood.isError`), que sigue abierto.
            const archived = await archiveFood.mutateAsync(selected.id).catch(() => null);
            if (archived) select(null);
          }}
          onOpenChange={(open) => {
            if (!open) {
              setConfirming(false);
              archiveFood.reset();
            }
          }}
        />
      ) : null}
    </>
  );
}

/**
 * Lo que dice el panel tras guardar: si quedó pendiente de publicar y qué cifras se redondearon a
 * un decimal (3,55 → 3,6), que es lo que el entrenador no ve venir.
 */
function savedNotice(
  saved: FoodDraft["composition"],
  typed: FoodFormValues,
  published: boolean,
): string {
  const rounded = MACROS.filter((macro) => typed[macro] !== saved[macro]).map(
    (macro) => `${t.panel.macroNames[macro]} ${formatNumber(saved[macro])} g`,
  );
  const base = published ? t.panel.saved : t.panel.savedPending;
  return rounded.length === 0
    ? base
    : `${base} ${t.panel.rounded.replace("{list}", rounded.join(", "))}`;
}
