"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Brand } from "@/components/ui/brand";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { useTrainer } from "@/lib/data/hooks";
import { es } from "@/lib/i18n/es";
import { cn, initialsOf } from "@/lib/utils";

const nav = es.nav.trainer;

/** Barra lateral del entrenador (pantalla 09). El orden incluye «Medidas», hueco §11.1. */
const items: { href: string; label: string }[] = [
  { href: "/dashboard", label: nav.dashboard },
  { href: "/clientes", label: nav.clientes },
  { href: "/biblioteca", label: nav.biblioteca },
  { href: "/plantillas", label: nav.plantillas },
  { href: "/cuestionario", label: nav.cuestionario },
  { href: "/medidas", label: nav.medidas },
  { href: "/membresias", label: nav.membresias },
  { href: "/asignacion", label: nav.asignacion },
];

export function TrainerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const trainer = useTrainer();
  const [firstName = "", ...rest] = trainer.data?.name.split(" ") ?? [];

  return (
    <div className="flex min-h-screen">
      <aside className="bg-background-deep border-border-subtle flex w-[232px] shrink-0 flex-col gap-7 border-r px-4 py-6">
        <Brand tag={es.common.coachTag} className="px-2" />
        <nav aria-label={es.roles.trainer} className="flex flex-col gap-0.5">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "font-display tracking-label rounded-r-sm border-l-[3px] px-3 py-2.5 text-[14px] uppercase transition-colors",
                  active
                    ? "bg-accent-soft text-accent-emphasis border-accent"
                    : "text-text-muted hover:text-text-primary border-transparent",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-border-subtle mt-auto flex items-center gap-2.5 border-t px-2 pt-2.5">
          <InitialsAvatar initials={trainer.data ? initialsOf(firstName, rest.join(" ")) : ""} />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold">{trainer.data?.name ?? " "}</p>
            <p className="text-text-subtle text-xs">{es.roles.trainer}</p>
          </div>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col gap-7 px-10 py-9">{children}</main>
    </div>
  );
}
