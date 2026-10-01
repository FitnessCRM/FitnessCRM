"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Brand } from "@/components/ui/brand";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { SheetClose } from "@/components/ui/sheet";
import { useClient, useSessionClientId } from "@/lib/data/hooks";
import { es } from "@/lib/i18n/es";
import { cn, initialsOf, shortNameOf } from "@/lib/utils";

const nav = es.nav.client;

/** Nav superior del cliente (pantalla 02). «Ver revisión» cuelga de Progreso. */
const items: { href: string; label: string; also?: string[] }[] = [
  { href: "/routine", label: nav.rutina },
  { href: "/menu", label: nav.menu },
  { href: "/weight", label: nav.peso },
  { href: "/review", label: nav.revision },
  { href: "/progress", label: nav.progreso, also: ["/view-review"] },
  { href: "/membership", label: nav.membresia },
];

export function ClientShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const client = useClient(useSessionClientId());
  const isActive = (item: (typeof items)[number]) =>
    [item.href, ...(item.also ?? [])].some((h) => pathname === h || pathname.startsWith(`${h}/`));
  const onProfile = pathname === "/profile";
  const initials = client.data ? initialsOf(client.data.firstName, client.data.lastName) : "";
  const shortName = client.data ? shortNameOf(client.data.firstName, client.data.lastName) : " ";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-background-deep border-border-subtle flex h-16 shrink-0 items-center gap-10 border-b px-10 max-sm:gap-4 max-sm:px-4">
        {/* Por debajo de `lg` los seis enlaces no caben: hamburguesa en vez de nav con scroll. */}
        <MobileNav
          className="lg:hidden"
          label={es.roles.client}
          items={items.map((item) => ({ ...item, active: isActive(item) }))}
          header={<Brand />}
          footer={
            <SheetClose asChild>
              <Link
                href="/profile"
                aria-label={es.screensClientProfile.link}
                aria-current={onProfile ? "page" : undefined}
                className="hover:bg-surface-raised -mx-2 flex items-center gap-2.5 rounded-sm px-2 py-1.5 transition-colors"
              >
                <InitialsAvatar initials={initials} />
                <p className="truncate text-[14px] font-semibold">{shortName}</p>
              </Link>
            </SheetClose>
          }
        />
        <Brand className="shrink-0 max-lg:hidden" />
        <nav aria-label={es.roles.client} className="flex min-w-0 flex-1 gap-1.5 max-lg:hidden">
          {items.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "font-display tracking-label shrink-0 rounded-sm px-4 py-2 text-[14px] uppercase transition-colors",
                  active ? "bg-accent text-on-accent" : "text-text-muted hover:text-text-primary",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/profile"
          aria-label={es.screensClientProfile.link}
          aria-current={onProfile ? "page" : undefined}
          className="hover:bg-surface-raised flex shrink-0 items-center gap-3 rounded-sm px-2 py-1 transition-colors max-lg:hidden"
        >
          <span className="text-text-muted text-sm max-sm:hidden">{shortName}</span>
          <InitialsAvatar initials={initials} />
        </Link>
      </header>
      <OfflineBanner />
      <main className="flex flex-1 flex-col gap-7 px-10 py-9 max-sm:px-4 max-sm:py-6">
        {children}
      </main>
    </div>
  );
}
