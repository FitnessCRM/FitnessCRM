"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { es } from "@/lib/i18n/es";

const t = es.editor.unsavedDialog;

/**
 * Destino interno de un clic que la app navegaría con el router, o `null` si el clic no es de esos:
 * con modificador o botón central (pestaña nueva), con `target`, de descarga, a otro origen o a la
 * misma página. Lo que devuelve es lo que se pasa a `router.push`.
 */
function internalTarget(event: MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = (event.target as Element | null)?.closest?.("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  const here = window.location;
  if (url.pathname === here.pathname && url.search === here.search) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Cambios sin guardar en un editor (E14). Cerrar o recargar la pestaña dispara el aviso del
 * navegador (`beforeunload`), y navegar dentro de la app —«← Volver», la barra lateral, el menú—
 * abre un diálogo propio, porque la navegación del router no pasa por `beforeunload`. El clic se
 * intercepta en captura, antes que el `Link` de Next. El botón «atrás» del navegador no se
 * intercepta. Devuelve el diálogo, que la pantalla pinta donde quiera.
 */
export function useUnsavedGuard(dirty: boolean): ReactNode {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const click = (event: MouseEvent) => {
      const target = internalTarget(event);
      if (target === null) return;
      event.preventDefault();
      event.stopPropagation();
      setPending(target);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);

  if (pending === null) return null;
  return (
    <Dialog open onOpenChange={(open) => !open && setPending(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setPending(null)}>
            {t.stay}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              const target = pending;
              setPending(null);
              router.push(target);
            }}
          >
            {t.leave}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
