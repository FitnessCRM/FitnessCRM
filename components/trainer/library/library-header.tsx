"use client";

import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { es } from "@/lib/i18n/es";

/**
 * Cabecera de la Biblioteca (ejercicios): título, la acción de la pantalla y el recuento. Los
 * alimentos tienen su propia sección y su propia cabecera en `components/trainer/foods/`.
 */
export function LibraryHeader({ action, count }: { action?: ReactNode; count?: ReactNode }) {
  return (
    <>
      <PageHeader title={es.pages.trainer.biblioteca} actions={action} />
      {count ? <p className="text-text-muted -mt-2 text-[13px]">{count}</p> : null}
    </>
  );
}
