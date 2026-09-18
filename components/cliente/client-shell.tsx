"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Brand } from "@/components/ui/brand";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { useClient, useSessionClientId } from "@/lib/data/hooks";
import { es } from "@/lib/i18n/es";
import { cn, initialsOf, shortNameOf } from "@/lib/utils";

const nav = es.nav.client;

/** Nav superior del cliente (pantalla 02). «Ver revisión» cuelga de Progreso. */
const items: { href: string; label: string; also?: string[] }[] = [
  { href: "/rutina", label: nav.rutina },
  { href: "/menu", label: nav.menu },
  { href: "/peso", label: nav.peso },
  { href: "/revision", label: nav.revision },
  { href: "/progreso", label: nav.progreso, also: ["/ver-revision"] },
  { href: "/membresia", label: nav.membresia },
];

export function ClientShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const client = useClient(useSessionClientId());

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-background-deep border-border-subtle flex h-16 shrink-0 items-center gap-10 border-b px-10">
        <Brand />
        <nav aria-label={es.roles.client} className="flex flex-1 gap-1.5">
          {items.map((item) => {
            const active = [item.href, ...(item.also ?? [])].some(
              (h) => pathname === h || pathname.startsWith(`${h}/`),
            );
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "font-display tracking-label rounded-sm px-4 py-2 text-[14px] uppercase transition-colors",
                  active ? "bg-accent text-on-accent" : "text-text-muted hover:text-text-primary",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-text-muted text-sm">
            {client.data ? shortNameOf(client.data.firstName, client.data.lastName) : " "}
          </span>
          <InitialsAvatar
            initials={client.data ? initialsOf(client.data.firstName, client.data.lastName) : ""}
          />
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-7 px-10 py-9">{children}</main>
    </div>
  );
}
