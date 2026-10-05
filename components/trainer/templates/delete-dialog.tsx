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
import { ErrorState } from "@/components/ui/states";
import { es } from "@/lib/i18n/es";

const t = es.screensTemplates.deleteDialog;

/**
 * Eliminar una plantilla no toca los planes de nadie (§4: se clonan al asignar). Se dice antes
 * de confirmar, para que nadie crea que borra su plan.
 */
export function DeleteDialog({
  name,
  isWorking,
  hasError,
  onConfirm,
  onOpenChange,
}: {
  name: string;
  isWorking: boolean;
  hasError: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t.title}: {name}
          </DialogTitle>
          <DialogDescription>{t.intro}</DialogDescription>
        </DialogHeader>
        {hasError ? <ErrorState message={t.error} /> : null}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isWorking}>
            {t.cancel}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isWorking}>
            {isWorking ? t.working : t.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
