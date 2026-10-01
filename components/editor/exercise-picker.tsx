"use client";

import { PlusIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Exercise } from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.editor.routine.picker;

/** Sin tildes ni mayúsculas: «prensa» encuentra «Prensa inclinada», «traccion» a «Tracción». */
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * Selector de ejercicios de la biblioteca: un botón punteado abre una ventana con buscador, filtro
 * por grupo muscular y la lista con grupo y material. Un toque en el ejercicio lo añade y cierra.
 */
export function ExercisePicker({
  library,
  label,
  onPick,
}: {
  library: Exercise[];
  /** Nombre accesible del botón: distingue un día de otro. */
  label: string;
  onPick: (exerciseId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [group, setGroup] = useState<string | null>(null);

  const groups = useMemo(
    () =>
      [...new Set(library.map((e) => e.muscleGroup).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [library],
  );
  const matches = useMemo(() => {
    const needle = fold(text.trim());
    return library
      .filter((e) => group === null || e.muscleGroup === group)
      .filter(
        (e) => needle === "" || fold(`${e.name} ${e.muscleGroup} ${e.equipment}`).includes(needle),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [library, text, group]);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setText("");
      setGroup(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="border-border-emphasis text-text-muted hover:border-accent/50 hover:text-text-primary focus-visible:ring-ring/50 flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-dashed px-4 text-[13px] transition-colors outline-none focus-visible:ring-[3px]"
        >
          <PlusIcon aria-hidden className="size-4" />
          {t.add}
        </button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(86dvh,640px)] flex-col gap-4 p-5 sm:max-w-xl sm:p-6">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.hint}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <SearchIcon
            aria-hidden
            className="text-text-subtle pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
          />
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t.search}
            aria-label={t.search}
            autoFocus
            className="pl-10"
          />
        </div>

        {groups.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {[null, ...groups].map((g) => (
              <button
                key={g ?? "all"}
                type="button"
                aria-pressed={group === g}
                onClick={() => setGroup(g)}
                className={cn(
                  "focus-visible:ring-ring/50 min-h-8 rounded-full border px-3 text-xs transition-colors outline-none focus-visible:ring-[3px]",
                  group === g
                    ? "border-accent/50 bg-accent-soft text-text-primary"
                    : "border-border-emphasis text-text-muted hover:text-text-primary",
                )}
              >
                {g ?? t.allGroups}
              </button>
            ))}
          </div>
        ) : null}

        <ul className="-mx-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1">
          {matches.length === 0 ? (
            <li className="text-text-subtle py-6 text-center text-sm">{t.empty}</li>
          ) : (
            matches.map((exercise) => {
              const meta = [exercise.muscleGroup, exercise.equipment].filter(Boolean).join(" · ");
              return (
                <li key={exercise.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(exercise.id);
                      onOpenChange(false);
                    }}
                    className="bg-surface-raised hover:bg-surface-overlay focus-visible:ring-ring/50 flex min-h-12 w-full items-center justify-between gap-3 rounded-md px-3.5 py-2.5 text-left transition-colors outline-none focus-visible:ring-[3px]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold">
                        {exercise.name}
                      </span>
                      {meta ? (
                        <span className="text-text-muted block truncate text-xs">{meta}</span>
                      ) : null}
                    </span>
                    <PlusIcon aria-hidden className="text-accent size-4 shrink-0" />
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
