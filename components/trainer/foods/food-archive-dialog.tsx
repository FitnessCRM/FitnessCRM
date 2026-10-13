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

const t = es.screensLibrary.foods.archive;

/**
 * «Eliminar» un alimento lo archiva (I13, §7): sale de la biblioteca y del catálogo común. A
 * diferencia del ejercicio no hay a quién avisar: ningún menú cambia, porque cada uno guarda su
 * copia congelada (I29).
 */
export function FoodArchiveDialog({
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
          <DialogDescription>{t.body}</DialogDescription>
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
