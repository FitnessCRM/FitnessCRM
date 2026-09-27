"use client";

import { ChevronDownIcon, ChevronUpIcon, XIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import { ArchiveCatalogDialog } from "./archive-dialog";

const t = es.screensCatalog;

/** Lo mínimo que el armazón necesita saber de una entrada de catálogo. */
export interface CatalogEntry {
  id: string;
  status: "activa" | "archivada";
}

/**
 * Armazón común de los catálogos del entrenador: preguntas y tipos de medida. Se ocupa del
 * orden, del archivado con su aviso, de las archivadas plegadas y del «+ Añadir»; cada pantalla
 * pone los campos de su fila. Se archiva, nunca se borra (I13), y se puede restaurar.
 */
export function CatalogList<T extends CatalogEntry>({
  hint,
  active,
  archived,
  addLabel,
  emptyTitle,
  emptyHint,
  isSaving,
  hasError,
  isDirty,
  labelOf,
  pending,
  renderRow,
  renderArchivedRow,
  onMove,
  onArchive,
  onUnarchive,
  onAdd,
  onSave,
}: {
  hint: string;
  active: T[];
  archived: T[];
  addLabel: string;
  emptyTitle: string;
  emptyHint: string;
  isSaving: boolean;
  hasError: boolean;
  isDirty: boolean;
  /** Cómo se llama la entrada en el aviso de archivado. */
  labelOf: (entry: T) => string;
  /** Filas añadidas y todavía sin guardar: van al final de la lista, no tras el botón. */
  pending?: ReactNode;
  renderRow: (entry: T, index: number) => ReactNode;
  renderArchivedRow: (entry: T) => ReactNode;
  onMove: (id: string, direction: -1 | 1) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onAdd: () => void;
  onSave: () => void;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const [confirming, setConfirming] = useState<T | null>(null);

  return (
    <div className="flex max-w-[900px] flex-col gap-4">
      <p className="text-text-muted text-[14px]">{hint}</p>

      {active.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyHint} />
      ) : (
        <Card className="gap-0 px-0 py-0">
          <ul>
            {active.map((entry, index) => (
              <li
                key={entry.id}
                className={cn(
                  "flex items-start gap-3 px-5 py-3.5",
                  index > 0 && "border-border-subtle border-t",
                )}
              >
                {/* Subir y bajar en vez de arrastrar: sin dependencia nueva y usable con teclado. */}
                <div className="flex shrink-0 flex-col">
                  <IconButton
                    label={t.moveUp}
                    disabled={index === 0}
                    onClick={() => onMove(entry.id, -1)}
                  >
                    <ChevronUpIcon className="size-4" />
                  </IconButton>
                  <IconButton
                    label={t.moveDown}
                    disabled={index === active.length - 1}
                    onClick={() => onMove(entry.id, 1)}
                  >
                    <ChevronDownIcon className="size-4" />
                  </IconButton>
                </div>

                <div className="min-w-0 flex-1">{renderRow(entry, index)}</div>

                <IconButton label={t.archive} onClick={() => setConfirming(entry)}>
                  <XIcon className="size-4" />
                </IconButton>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {pending}

      <button
        type="button"
        onClick={onAdd}
        className="border-border-subtle text-text-muted hover:border-border-emphasis hover:text-text-primary focus-visible:ring-ring/50 rounded-lg border border-dashed py-3 text-[14px] transition-colors outline-none focus-visible:ring-[3px]"
      >
        {addLabel}
      </button>

      {hasError ? <ErrorState message={t.saveError} /> : null}

      {/* Pegado abajo y en acento cuando hay borrador: salir de la pantalla lo pierde, así que
          el aviso no puede quedarse arriba fuera de la vista. */}
      <div
        className={cn(
          "sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 backdrop-blur",
          isDirty ? "border-accent-outline bg-accent-soft" : "bg-background/80 border-transparent",
        )}
      >
        <p
          aria-live="polite"
          className={cn("text-[13px]", isDirty ? "text-accent-bright" : "text-text-subtle")}
        >
          {isDirty ? t.unsaved : t.applies}
        </p>
        <Button onClick={onSave} disabled={isSaving || !isDirty}>
          {isSaving ? t.saving : t.save}
        </Button>
      </div>

      {archived.length > 0 ? (
        <div className="border-border-subtle mt-2 border-t pt-4">
          <button
            type="button"
            aria-expanded={showArchived}
            onClick={() => setShowArchived((v) => !v)}
            className="text-text-muted hover:text-text-primary focus-visible:ring-ring/50 tracking-label inline-flex items-center gap-1.5 text-[13px] uppercase outline-none focus-visible:ring-[3px]"
          >
            {showArchived ? t.archivedHide : t.archivedShow} ({archived.length})
            {showArchived ? (
              <ChevronUpIcon aria-hidden className="size-3.5" />
            ) : (
              <ChevronDownIcon aria-hidden className="size-3.5" />
            )}
          </button>

          {showArchived ? (
            <div className="mt-3 flex flex-col gap-2.5">
              <p className="text-text-subtle text-xs">{t.archivedHint}</p>
              <ul className="flex flex-col gap-2">
                {archived.map((entry) => (
                  <li
                    key={entry.id}
                    className="border-border-subtle flex items-center gap-3 rounded-lg border px-4 py-2.5"
                  >
                    <div className="text-text-muted min-w-0 flex-1 text-[14px]">
                      {renderArchivedRow(entry)}
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => onUnarchive(entry.id)}>
                      {t.unarchive}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {confirming ? (
        <ArchiveCatalogDialog
          name={labelOf(confirming)}
          onConfirm={() => {
            onArchive(confirming.id);
            setConfirming(null);
          }}
          onOpenChange={(open) => {
            if (!open) setConfirming(null);
          }}
        />
      ) : null}
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="text-text-subtle hover:text-text-primary focus-visible:ring-ring/50 grid size-8 shrink-0 place-items-center rounded-md outline-none focus-visible:ring-[3px] disabled:opacity-30"
    >
      {children}
    </button>
  );
}
