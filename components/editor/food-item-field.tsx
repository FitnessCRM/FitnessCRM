"use client";

import { useId, useImperativeHandle, useRef, useState, type Ref } from "react";
import { FoodOriginBadges } from "@/components/ui/food-origin-badges";
import { useDebouncedValue } from "@/components/ui/use-debounced-value";
import type { FoodItem, LibraryFood } from "@/lib/domain";
import { useFoods } from "@/lib/data/hooks";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import {
  escapeFoodNameEdit,
  pickFoodForName,
  startFoodNameEdit,
  typeFoodName,
  type FoodNameEdit,
} from "./food-name-edit";
import { nutrientLine } from "./nutrient-line";

const t = es.editor.menu;
const s = t.suggestions;

/** Espera entre teclas antes de buscar: cada texto es una búsqueda nueva en el catálogo. */
const SEARCH_DEBOUNCE_MS = 300;

/** Lo que se puede elegir en el desplegable: un alimento o una acción. */
type Option =
  | { kind: "food"; food: LibraryFood }
  | { kind: "more" }
  | { kind: "retryCatalog" }
  | { kind: "retryOwn" }
  | { kind: "create" };

interface SuggestionsHandle {
  count: () => number;
  activate: (index: number) => void;
}

/**
 * Campo del nombre de un alimento del menú (§5): busca a la vez en tus alimentos y en el catálogo
 * común, y admite texto libre. Patrón ARIA «combobox» con lista y `aria-activedescendant`: el foco
 * se queda siempre en el campo.
 *
 * El nombre se renombra en cada tecla, desde el alimento tal como estaba al entrar en el campo
 * (`food-name-edit.ts`): volver al nombre original recupera el vínculo y Escape lo restaura. Así la
 * pantalla ve el cambio al momento («Guardar», «Sin guardar», aviso al salir).
 */
export function FoodItemField({
  item,
  onChange,
  onCreate,
  describedBy,
}: {
  item: FoodItem;
  onChange: (item: FoodItem) => void;
  /** Crear un alimento sin salir del menú, con el nombre escrito. */
  onCreate: (name: string) => void;
  describedBy?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestions = useRef<SuggestionsHandle>(null);
  const [edit, setEdit] = useState<FoodNameEdit | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const text = edit?.text ?? item.name;
  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const pick = (food: LibraryFood) => {
    const step = pickFoodForName(edit ?? startFoodNameEdit(item), food);
    setEdit(step.edit);
    onChange(step.item);
    close();
    // Elegido el alimento, lo siguiente son sus gramos.
    inputRef.current
      ?.closest("[data-food-row]")
      ?.querySelector<HTMLInputElement>("input[type=number]")
      ?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const count = suggestions.current?.count() ?? 0;
      if (count === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i === -1 ? (step === 1 ? 0 : count - 1) : (i + step + count) % count));
    } else if (event.key === "Enter") {
      if (!open) return;
      event.preventDefault();
      // Sin opción activa, lo escrito se queda como texto libre: nunca se elige una sola.
      if (active >= 0) suggestions.current?.activate(active);
      else close();
    } else if (event.key === "Escape") {
      const step = edit ? escapeFoodNameEdit(edit) : null;
      if (!open && !step) return;
      event.preventDefault();
      close();
      if (step) {
        setEdit(step.edit);
        onChange(step.item);
      }
    } else if (event.key === "Tab") {
      close();
    }
  };

  return (
    <div className="relative min-w-0">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={t.itemName}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        placeholder={t.itemPlaceholder}
        value={text}
        onFocus={() => {
          setEdit(startFoodNameEdit(item));
          setOpen(true);
        }}
        // Tras cerrar con Escape o Intro sigue con el foco: un clic vuelve a abrir la lista.
        onClick={() => setOpen(true)}
        onBlur={() => {
          setEdit(null);
          close();
        }}
        onChange={(event) => {
          const step = typeFoodName(edit ?? startFoodNameEdit(item), event.target.value);
          setEdit(step.edit);
          onChange(step.item);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
        className={cn(
          "border-border-emphasis bg-background font-ui text-text-primary placeholder:text-text-subtle h-10 w-full rounded-md border px-3 text-[14px] transition-[color,box-shadow] outline-none",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        )}
      />
      {open ? (
        <FoodSuggestions
          handle={suggestions}
          listId={listId}
          text={text}
          active={active}
          onActive={setActive}
          onPick={pick}
          onCreate={() => {
            close();
            onCreate(text.trim());
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * El desplegable. Solo existe con la lista abierta: así cada fila del menú no lanza su propia
 * búsqueda en el catálogo al montarse. Sin texto, tus alimentos y nada del catálogo, que se busca y
 * no se lista (§4). Un catálogo que no responde o falla no impide elegir lo tuyo ni escribir.
 */
function FoodSuggestions({
  handle,
  listId,
  text,
  active,
  onActive,
  onPick,
  onCreate,
}: {
  handle: Ref<SuggestionsHandle>;
  listId: string;
  text: string;
  active: number;
  onActive: (index: number) => void;
  onPick: (food: LibraryFood) => void;
  onCreate: () => void;
}) {
  const query = useDebouncedValue(text.trim(), SEARCH_DEBOUNCE_MS, (value) => value === "");
  const library = useFoods({ text: query, onlyMine: query === "" });

  const own = (library.foods ?? [])
    .filter((food) => food.origin === "own")
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const fromCatalog = (library.foods ?? []).filter((food) => food.origin !== "own");
  // Lo del catálogo llega unido a tus alimentos, para no repetir lo que ya es tuyo (§4): mientras
  // no han llegado, del catálogo no hay nada que enseñar todavía, aunque la búsqueda haya vuelto.
  // Si tus alimentos fallan, manda su «Reintentar» y el catálogo no dice nada.
  const ownReady = library.foods !== undefined;
  const catalog =
    ownReady || library.catalog === null
      ? library.catalog
      : library.isError
        ? "blocked"
        : "loading";

  const ownOptions: Option[] = library.isError
    ? [{ kind: "retryOwn" }]
    : own.map((food) => ({ kind: "food", food }));
  const catalogOptions: Option[] =
    catalog === "error"
      ? [{ kind: "retryCatalog" }]
      : catalog === "available"
        ? [
            ...fromCatalog.map((food): Option => ({ kind: "food", food })),
            ...(library.catalogMore.hasMore || library.catalogMore.error
              ? [{ kind: library.catalogMore.error ? "retryCatalog" : "more" } as Option]
              : []),
          ]
        : [];
  const options: Option[] = [...ownOptions, ...catalogOptions, { kind: "create" }];

  const activate = (index: number) => {
    const option = options[index];
    if (!option) return;
    if (option.kind === "food") onPick(option.food);
    else if (option.kind === "more") library.catalogMore.loadMore();
    else if (option.kind === "retryCatalog")
      if (library.catalogMore.error) library.catalogMore.loadMore();
      else library.retryCatalog();
    else if (option.kind === "retryOwn") void library.refetch();
    else onCreate();
  };

  useImperativeHandle(handle, () => ({ count: () => options.length, activate }));

  const ownNote = library.isPending
    ? s.ownLoading
    : library.isError
      ? s.ownError
      : own.length === 0
        ? // Sin texto salen todos los tuyos: si no hay ninguno, no es que no coincidan.
          query === ""
          ? s.ownEmpty
          : s.noOwn
        : null;
  const catalogNote =
    catalog === null
      ? s.typeToSearch
      : catalog === "loading"
        ? s.catalogLoading
        : catalog === "unavailable"
          ? s.catalogUnavailable
          : catalog === "error"
            ? s.catalogError
            : catalog === "blocked"
              ? null
              : fromCatalog.length === 0
                ? s.noCatalog
                : library.catalogMore.error
                  ? s.moreError
                  : null;
  const summary = [
    library.isPending || library.isError ? ownNote : s.countOwn.replace("{n}", String(own.length)),
    catalog === "available"
      ? s.countCatalog.replace("{n}", String(fromCatalog.length))
      : catalogNote,
  ]
    .filter(Boolean)
    .join(" · ");

  let index = -1;
  const renderOption = (option: Option) => {
    index += 1;
    const i = index;
    return (
      <SuggestionOption
        key={option.kind === "food" ? option.food.id : `${option.kind}-${i}`}
        id={`${listId}-${i}`}
        option={option}
        active={i === active}
        loadingMore={library.catalogMore.isLoadingMore}
        createLabel={text.trim() === "" ? s.createEmpty : s.create.replace("{name}", text.trim())}
        onActivate={() => activate(i)}
        onHover={() => onActive(i)}
      />
    );
  };

  return (
    <div
      // Pulsar en el desplegable (su barra de desplazamiento, un título) no le quita el foco al campo.
      onMouseDown={(event) => event.preventDefault()}
      className="border-border-strong bg-surface-overlay absolute top-full right-0 left-0 z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border p-1 shadow-lg"
    >
      <p role="status" className="sr-only">
        {summary}
      </p>
      <div id={listId} role="listbox" aria-label={s.label}>
        <SuggestionGroup id={`${listId}-own`} title={s.own} note={ownNote}>
          {ownOptions.map(renderOption)}
        </SuggestionGroup>
        <SuggestionGroup id={`${listId}-catalog`} title={s.catalog} note={catalogNote}>
          {catalogOptions.map(renderOption)}
        </SuggestionGroup>
        <div role="group" aria-label={s.createEmpty} className="border-border-subtle border-t pt-1">
          {renderOption({ kind: "create" })}
        </div>
      </div>
    </div>
  );
}

function SuggestionGroup({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note: string | null;
  children: React.ReactNode;
}) {
  return (
    <div role="group" aria-labelledby={id} className="pb-1">
      <div
        id={id}
        role="presentation"
        className="font-display tracking-label text-text-subtle px-3 pt-2 pb-1 text-[11px] uppercase"
      >
        {title}
      </div>
      {/* Lo que dice el grupo lo anuncia la región de estado; aquí es para quien mira. */}
      {note ? (
        <div aria-hidden className="text-text-subtle px-3 py-1.5 text-[13px]">
          {note}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function SuggestionOption({
  id,
  option,
  active,
  loadingMore,
  createLabel,
  onActivate,
  onHover,
}: {
  id: string;
  option: Option;
  active: boolean;
  loadingMore: boolean;
  createLabel: string;
  onActivate: () => void;
  onHover: () => void;
}) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      // `mousedown` y no `click`: el campo perdería el foco antes y cerraría la lista.
      onMouseDown={(event) => {
        event.preventDefault();
        onActivate();
      }}
      onMouseEnter={onHover}
      className={cn(
        "flex min-h-10 cursor-pointer flex-col justify-center gap-1 rounded-md px-3 py-2 text-[14px]",
        active ? "bg-border-strong" : "hover:bg-surface-raised",
        option.kind === "create" && "text-accent-emphasis",
        (option.kind === "more" || option.kind === "retryCatalog" || option.kind === "retryOwn") &&
          "text-text-muted",
      )}
    >
      {option.kind === "food" ? (
        <>
          <span className="text-text-primary font-semibold [overflow-wrap:anywhere]">
            {option.food.name}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <FoodOriginBadges food={option.food} />
            <span className="text-text-muted text-xs tabular-nums">
              {nutrientLine(option.food.composition)} {t.per100}
            </span>
          </span>
        </>
      ) : option.kind === "more" ? (
        loadingMore ? (
          s.loadingMore
        ) : (
          s.more
        )
      ) : option.kind === "create" ? (
        createLabel
      ) : (
        s.retry
      )}
    </div>
  );
}
