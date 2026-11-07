"use client";

import Link from "next/link";
import { MenuIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

export type MobileNavItem = { href: string; label: string; active: boolean };

/**
 * Menú de hamburguesa para los dos shells por debajo de `lg`. Terreno neutro: lo usan
 * `trainer/` y `client/`, que no se importan entre sí. `label` nombra la navegación (también
 * es el título accesible del panel); `header` y `footer` son la marca y el bloque de usuario.
 * Cada enlace es un `SheetClose`, así que navegar cierra el panel.
 */
export function MobileNav({
  label,
  items,
  header,
  footer,
  className,
}: {
  label: string;
  items: MobileNavItem[];
  header: ReactNode;
  footer: ReactNode;
  className?: string;
}) {
  return (
    <Sheet>
      <SheetTrigger
        aria-label={es.nav.toggle}
        className={cn(
          "text-text-primary hover:bg-surface-raised -ml-2 grid size-10 shrink-0 place-items-center rounded-sm transition-colors",
          className,
        )}
      >
        <MenuIcon aria-hidden className="size-5" />
      </SheetTrigger>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle className="sr-only">{label}</SheetTitle>
        <SheetClose asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={es.common.close}
            className="shrink-0 self-end"
          >
            <XIcon />
          </Button>
        </SheetClose>
        <div className="shrink-0 px-2">{header}</div>
        {/* El panel mide lo que la pantalla: si los enlaces no caben, hacen scroll ellos solos y el
            pie (el bloque de usuario con «Cerrar sesión») sigue a la vista (tarjeta 140). */}
        <nav aria-label={label} className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
          {items.map((item) => (
            <SheetClose asChild key={item.href}>
              <Link
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className={cn(
                  "font-display tracking-label rounded-r-sm border-l-[3px] px-3 py-2.5 text-[14px] uppercase transition-colors",
                  item.active
                    ? "bg-accent-soft text-accent-emphasis border-accent"
                    : "text-text-muted hover:text-text-primary border-transparent",
                )}
              >
                {item.label}
              </Link>
            </SheetClose>
          ))}
        </nav>
        <div className="border-border-subtle mt-auto shrink-0 border-t px-2 pt-2.5">{footer}</div>
      </SheetContent>
    </Sheet>
  );
}
