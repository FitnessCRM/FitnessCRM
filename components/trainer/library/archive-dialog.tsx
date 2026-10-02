"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/ui/states";
import type { Client, Exercise } from "@/lib/domain";
import { es } from "@/lib/i18n/es";

const t = es.screensLibrary.archive;

/**
 * «Eliminar» archiva (I13, §7): el ejercicio sale de la biblioteca y de los planes vivos, pero
 * la fila sobrevive y las rutinas archivadas no se tocan. Antes de confirmar hay que decir a
 * quién afecta, que es lo único que el entrenador no puede deducir de la pantalla.
 */
export function ArchiveDialog({
  exercise,
  usage,
  isLoadingUsage,
  usageError,
  onRetryUsage,
  clients,
  isWorking,
  hasError,
  onConfirm,
  onOpenChange,
}: {
  exercise: Exercise;
  /** Quién lo usa ahora, tal como lo devuelve el hook: clientes y plantillas afectadas. */
  usage: { clientIds: string[]; routineTemplateIds: string[] } | undefined;
  isLoadingUsage: boolean;
  /** La consulta de uso falló: no se sabe a quién afecta, así que no se deja confirmar. */
  usageError: boolean;
  onRetryUsage: () => void;
  clients: Client[];
  isWorking: boolean;
  hasError: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const names = (usage?.clientIds ?? []).map((id) => {
    const client = clients.find((c) => c.id === id);
    return client ? `${client.firstName} ${client.lastName}` : id;
  });
  const templates = usage?.routineTemplateIds.length ?? 0;
  const untouched = usage !== undefined && names.length === 0 && templates === 0;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t.title}: {exercise.name}
          </DialogTitle>
          <DialogDescription>
            {t.intro} {t.keepsHistory}
          </DialogDescription>
        </DialogHeader>

        {isLoadingUsage ? <LoadingState /> : null}

        {usageError ? <ErrorState message={t.usageError} onRetry={onRetryUsage} /> : null}

        {untouched ? <p className="text-text-muted text-[14px]">{t.noUse}</p> : null}

        {names.length > 0 ? (
          <div>
            <p className="text-text-subtle tracking-label text-[11px] uppercase">{t.clients}</p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {names.map((name) => (
                <li key={name} className="text-text-primary text-[14px]">
                  {name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {templates > 0 ? (
          <p className="text-text-muted text-[14px]">
            {t.templates} {templates}
          </p>
        ) : null}

        {hasError ? <ErrorState message={t.error} /> : null}

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isWorking}>
            {t.cancel}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isWorking || isLoadingUsage || usageError || usage === undefined}
          >
            {isWorking ? t.working : t.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
