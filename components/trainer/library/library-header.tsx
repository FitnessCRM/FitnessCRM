"use client";

import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.screensLibrary.tabs;

export const LIBRARY_TABS = ["exercises", "foods"] as const;
export type LibraryTab = (typeof LIBRARY_TABS)[number];

const PANEL_ID = "library-panel";
const triggerId = (tab: LibraryTab) => `library-tab-${tab}`;

/**
 * Cabecera de la Biblioteca: título, la acción de la pestaña activa, las pestañas y el recuento.
 * La pinta cada pestaña porque la acción y el recuento son suyos. Solo se monta la pestaña activa,
 * así que no hay dos listas de pestañas a la vez; el panel lo pone `LibraryPanel`.
 */
export function LibraryHeader({ action, count }: { action?: ReactNode; count?: ReactNode }) {
  return (
    <>
      <PageHeader title={es.pages.trainer.biblioteca} actions={action} />
      <div className="-mt-2 flex flex-col gap-3">
        <TabsList aria-label={t.label} className="max-w-full">
          {LIBRARY_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} id={triggerId(tab)} aria-controls={PANEL_ID}>
              {t[tab]}
            </TabsTrigger>
          ))}
        </TabsList>
        {count ? <p className="text-text-muted text-[13px]">{count}</p> : null}
      </div>
    </>
  );
}

/** El contenido de la pestaña activa, enlazado a su pestaña para los lectores de pantalla. */
export function LibraryPanel({
  tab,
  className,
  children,
}: {
  tab: LibraryTab;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      id={PANEL_ID}
      role="tabpanel"
      aria-labelledby={triggerId(tab)}
      className={cn("outline-none", className)}
    >
      {children}
    </div>
  );
}
