"use client";

import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
}

/** Sin tildes ni mayúsculas: «lucia» encuentra «Lucía». */
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * Autocompletado de una sola elección: un campo de texto que filtra la lista mientras se
 * escribe (patrón ARIA «combobox» con lista). Con `allLabel`, la primera opción deshace la
 * elección; sin él siempre hay una elegida y no existe esa opción.
 */
export function Combobox({
  options,
  value,
  onChange,
  allLabel,
  label,
  placeholder,
  emptyLabel,
  className,
  inputClassName,
}: {
  options: ComboboxOption[];
  /** `null` = ninguna elegida. */
  value: string | null;
  onChange: (value: string | null) => void;
  allLabel?: string;
  label: string;
  placeholder: string;
  emptyLabel: string;
  className?: string;
  /** Clases del campo de texto (la altura, por ejemplo); `className` es del contenedor. */
  inputClassName?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);

  const selected = options.find((o) => o.value === value) ?? null;
  const needle = fold(text.trim());
  const matches = useMemo(
    () => options.filter((o) => needle === "" || fold(o.label).includes(needle)),
    [options, needle],
  );
  // La opción «todos» va siempre primera y solo cuando no se está buscando.
  const items: { value: string | null; label: string }[] =
    needle === "" && allLabel !== undefined
      ? [{ value: null, label: allLabel }, ...matches]
      : matches;

  const choose = (item: { value: string | null }) => {
    onChange(item.value);
    setOpen(false);
    setText("");
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (items.length === 0 ? 0 : (i + step + items.length) % items.length));
    } else if (event.key === "Enter" && open && items[active]) {
      event.preventDefault();
      choose(items[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
      setText("");
    }
  };

  return (
    <div className={cn("relative", className)}>
      <input
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && items[active] ? `${id}-${active}` : undefined}
        autoComplete="off"
        placeholder={selected ? selected.label : placeholder}
        value={open ? text : (selected?.label ?? "")}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setText("");
        }}
        onChange={(event) => {
          setText(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className={cn(
          "border-border-emphasis bg-background font-ui text-text-primary placeholder:text-text-muted h-9 w-full rounded-md border px-3.5 text-[14px] transition-[color,box-shadow] outline-none",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          inputClassName,
        )}
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="border-border-emphasis bg-surface-overlay absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border p-1 shadow-lg"
        >
          {items.length === 0 ? (
            <li className="text-text-subtle px-3 py-2 text-sm">{emptyLabel}</li>
          ) : (
            items.map((item, index) => (
              <li
                key={item.value ?? "all"}
                id={`${id}-${index}`}
                role="option"
                aria-selected={item.value === value}
                // `mousedown` y no `click`: el campo pierde el foco antes y cerraría la lista.
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(item);
                }}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  "cursor-pointer rounded-sm px-3 py-2 text-sm",
                  index === active ? "bg-border-strong text-text-primary" : "text-text-muted",
                  item.value === value && "text-text-primary font-semibold",
                )}
              >
                {item.label}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
