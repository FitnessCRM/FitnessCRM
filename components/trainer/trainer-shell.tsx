"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Brand } from "@/components/ui/brand";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { useTrainer } from "@/lib/data/hooks";
import { es } from "@/lib/i18n/es";
import { cn, initialsOf } from "@/lib/utils";

const nav = es.nav.trainer;

/** Barra lateral del entrenador (pantalla 09). El orden incluye «Medidas», hueco §11.1. */
const items: { href: string; label: string }[] = [
  { href: "/dashboard", label: nav.dashboard },
  { href: "/clientes", label: nav.clientes },
  { href: "/library", label: nav.biblioteca },
  { href: "/templates", label: nav.plantillas },
  { href: "/questionnaire", label: nav.cuestionario },
  { href: "/measurements", label: nav.medidas },
  { href: "/memberships", label: nav.membresias },
  { href: "/assignment", label: nav.asignacion },
];

export function TrainerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const trainer = useTrainer();
  const [firstName = "", ...rest] = trainer.data?.name.split(" ") ?? [];
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const initials = trainer.data ? initialsOf(firstName, rest.join(" ")) : "";
  const userBlock = (
    <div className="flex items-center gap-2.5">
      <InitialsAvatar initials={initials} />
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold">{trainer.data?.name ?? " "}</p>
        <p className="text-text-subtle text-xs">{es.roles.trainer}</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen max-lg:flex-col">
      {/* Por debajo de `lg` la barra lateral se sustituye por barra superior + hamburguesa. */}
      <header className="bg-background-deep border-border-subtle flex h-16 shrink-0 items-center gap-3 border-b px-4 lg:hidden">
        <MobileNav
          label={es.roles.trainer}
          items={items.map((item) => ({ ...item, active: isActive(item.href) }))}
          header={<Brand tag={es.common.coachTag} />}
          footer={userBlock}
        />
        <Brand tag={es.common.coachTag} className="min-w-0 flex-1" />
        <InitialsAvatar initials={initials} />
      </header>
      <aside className="bg-background-deep border-border-subtle flex w-[232px] shrink-0 flex-col gap-7 border-r px-4 py-6 max-lg:hidden">
        <Brand tag={es.common.coachTag} className="px-2" />
        <nav aria-label={es.roles.trainer} className="flex flex-col gap-0.5">
          {items.map((item) => {
            const active = isActive(item.href);
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
        <div className="border-border-subtle mt-auto border-t px-2 pt-2.5">{userBlock}</div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col gap-7 px-10 py-9 max-lg:px-4 max-lg:py-6">
        {children}
      </main>
    </div>
  );
}
