"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { useAssignTemplate } from "@/lib/data/hooks";
import { DomainError } from "@/lib/domain";
import { es } from "@/lib/i18n/es";

const t = es.replaceDraftDialog;

type Kind = "routine" | "menu";

/** El cliente ya tiene un borrador de ese plan (I32): no es un fallo, es una pregunta. */
export function isDraftExists(error: unknown): boolean {
  return error instanceof DomainError && error.code === "plan.draft_exists";
}

/**
 * Asignar una plantilla preguntando antes de sustituir un borrador (I32, E9). La primera llamada va
 * sin sustituir; si el cliente ya tiene borrador, abre el diálogo y, si el entrenador confirma,
 * repite la asignación con `replaceDraft`. Devuelve la función que asigna y el diálogo, que la
 * pantalla pinta donde quiera.
 */
export function useAssignWithDraftCheck(assign: ReturnType<typeof useAssignTemplate>): {
  run: (kind: Kind, templateId: string, onSuccess?: () => void) => Promise<void>;
  dialog: ReactNode;
} {
  const [pending, setPending] = useState<{
    kind: Kind;
    templateId: string;
    onSuccess?: () => void;
  } | null>(null);

  const run = async (kind: Kind, templateId: string, onSuccess?: () => void) => {
    try {
      await assign.mutateAsync({ kind, templateId });
      onSuccess?.();
    } catch (error) {
      // Cualquier otro fallo lo pinta la pantalla desde el estado de la mutación.
      if (isDraftExists(error)) setPending({ kind, templateId, onSuccess });
    }
  };

  const confirm = async () => {
    if (!pending) return;
    const { kind, templateId, onSuccess } = pending;
    setPending(null);
    const done = await assign
      .mutateAsync({ kind, templateId, replaceDraft: true })
      .then(() => true)
      .catch(() => false);
    if (done) onSuccess?.();
  };

  const dialog =
    pending === null ? null : (
      <Dialog open onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.title}</DialogTitle>
            <DialogDescription>{pending.kind === "routine" ? t.routine : t.menu}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPending(null)}>
              {t.cancel}
            </Button>
            <Button variant="destructive" onClick={() => void confirm()}>
              {t.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );

  return { run, dialog };
}
