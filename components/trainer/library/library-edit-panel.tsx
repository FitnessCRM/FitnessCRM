import type { ReactNode } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/states";
import { es } from "@/lib/i18n/es";

/**
 * El panel de edición de una pestaña de la biblioteca. Desde `xl` va a la derecha, en una tarjeta,
 * con un estado vacío mientras no hay nada seleccionado. Por debajo, en un `Sheet` lateral, porque
 * un formulario no es contexto que leer antes de la lista y en móvil no debe tapar la rejilla entera.
 * Lo usan las dos pestañas, así que ambas se comportan igual.
 */
export function LibraryEditPanel({
  wide,
  open,
  onClose,
  panel,
  emptyTitle,
  emptyHint,
  footer,
}: {
  wide: boolean;
  open: boolean;
  onClose: () => void;
  /** El formulario de la selección, o `null` si no hay nada seleccionado. */
  panel: ReactNode;
  emptyTitle: string;
  emptyHint: string;
  /** Lo que va debajo del formulario, dentro de la tarjeta o del `Sheet`. */
  footer?: ReactNode;
}) {
  if (wide) {
    return (
      <aside className="flex flex-col gap-4">
        {panel ? (
          <Card className="gap-4 px-[22px] py-[22px]">
            {panel}
            {footer}
          </Card>
        ) : (
          <EmptyState title={emptyTitle} description={emptyHint} />
        )}
      </aside>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <SheetContent
        side="right"
        aria-describedby={undefined}
        className="bg-surface w-full max-w-full gap-4 overflow-y-auto px-4 py-5 sm:w-[420px] sm:max-w-[420px] sm:px-6"
      >
        <SheetClose asChild>
          <Button variant="ghost" size="icon" aria-label={es.common.close} className="self-end">
            <XIcon />
          </Button>
        </SheetClose>
        {panel}
        {footer}
      </SheetContent>
    </Sheet>
  );
}
