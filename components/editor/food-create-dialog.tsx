"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { Food } from "@/lib/domain";
import { useSaveFood } from "@/lib/data/hooks";
import { es } from "@/lib/i18n/es";
import { FoodForm } from "./food-form";

const t = es.editor.menu.createFood;

/**
 * Crear un alimento sin salir del menú: se guarda en tus alimentos y la fila pasa a usarlo. Si el
 * catálogo común no responde se crea igual, pendiente de publicar (§7), y se usa ya.
 */
export function FoodCreateDialog({
  name,
  onCreated,
  onOpenChange,
}: {
  /** Lo que ya estaba escrito en la fila. */
  name: string;
  onCreated: (food: Food) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const saveFood = useSaveFood();

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto max-sm:p-5">
        <FoodForm
          food={null}
          initialName={name}
          submitLabel={t.submit}
          title={(heading) => (
            <div className="flex flex-col gap-1">
              <DialogTitle>{heading}</DialogTitle>
              <DialogDescription>{t.description}</DialogDescription>
            </div>
          )}
          isSaving={saveFood.isPending}
          saveError={saveFood.isError}
          onSubmit={async (draft) => {
            // Si falla, lo dice el formulario (`saveFood.isError`) y el diálogo sigue abierto.
            const result = await saveFood.mutateAsync({ draft }).catch(() => null);
            if (result) onCreated(result.food);
          }}
          onEdit={() => {}}
          onDelete={() => {}}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
