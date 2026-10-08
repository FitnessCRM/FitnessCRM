"use client";

import { useSyncExternalStore } from "react";

/**
 * Si la ventana cumple una media query. Para lo que no se resuelve con CSS: montar un componente en
 * un sitio u otro sin pintarlo dos veces. En el servidor, `false`.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Desde `xl` (1280 px), el ancho al que la Biblioteca pasa a dos columnas. */
export const XL_MEDIA_QUERY = "(min-width: 80rem)";
