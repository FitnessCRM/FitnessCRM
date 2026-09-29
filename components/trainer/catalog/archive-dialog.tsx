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
import { es } from "@/lib/i18n/es";

const t = es.screensCatalog.archiveDialog;

/**
 * Archivar una entrada de catálogo no borra nada (I13) ni toca el histórico, que guarda su copia
 * congelada (I12). Por eso el aviso es corto: lo único que cambia es lo que se pide a partir de
 * la próxima revisión, y se puede deshacer.
 */
export function ArchiveCatalogDialog({
  name,
  onConfirm,
  onOpenChange,
}: {
  name: string;
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
          <DialogDescription>
            {t.intro} {t.restoreHint}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {t.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
