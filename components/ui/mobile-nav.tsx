"use client";

import Link from "next/link";
import { MenuIcon } from "lucide-react";
import type { ReactNode } from "react";
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
        <div className="px-2">{header}</div>
        <nav aria-label={label} className="flex flex-col gap-0.5">
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
        <div className="border-border-subtle mt-auto border-t px-2 pt-2.5">{footer}</div>
      </SheetContent>
    </Sheet>
  );
}
