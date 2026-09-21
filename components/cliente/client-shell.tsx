"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
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
  const navRef = useRef<HTMLElement>(null);

  // En móvil el nav se desplaza en su caja: centra el apartado activo, o no se ve dónde estás.
  // Se recalcula al cargar las fuentes (Oswald ensancha los enlaces) y al cambiar el ancho del
  // nav (en un navegador estrecho, la barra de scroll aparece cuando carga el contenido).
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const center = () => {
      const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (!active || nav.scrollWidth <= nav.clientWidth) return;
      const box = nav.getBoundingClientRect();
      const item = active.getBoundingClientRect();
      nav.scrollLeft += item.left + item.width / 2 - (box.left + box.width / 2);
    };
    center();
    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (!cancelled) center();
    });
    const observer = new ResizeObserver(center);
    observer.observe(nav);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-background-deep border-border-subtle flex h-16 shrink-0 items-center gap-10 border-b px-10 max-sm:gap-4 max-sm:px-4">
        <Brand className="shrink-0" />
        {/* El nav se desplaza dentro de su caja: en móvil no puede ensanchar la página. */}
        <nav
          ref={navRef}
          aria-label={es.roles.client}
          className="flex min-w-0 flex-1 [scrollbar-width:none] gap-1.5 overflow-x-auto [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
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
                  "font-display tracking-label shrink-0 rounded-sm px-4 py-2 text-[14px] uppercase transition-colors",
                  active ? "bg-accent text-on-accent" : "text-text-muted hover:text-text-primary",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-text-muted text-sm max-sm:hidden">
            {client.data ? shortNameOf(client.data.firstName, client.data.lastName) : " "}
          </span>
          <InitialsAvatar
            initials={client.data ? initialsOf(client.data.firstName, client.data.lastName) : ""}
          />
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-7 px-10 py-9 max-sm:px-4 max-sm:py-6">
        {children}
      </main>
    </div>
  );
}
