"use client";

import { useEffect, useState } from "react";

/**
 * El valor, cuando lleva `delayMs` sin cambiar. Para buscar mientras se escribe sin lanzar una
 * búsqueda por tecla. Con `immediate` el valor pasa sin espera (vaciar el buscador, por ejemplo).
 */
export function useDebouncedValue<T>(
  value: T,
  delayMs: number,
  immediate: (value: T) => boolean = () => false,
): T {
  const [debounced, setDebounced] = useState(value);
  const skip = immediate(value);

  useEffect(() => {
    if (skip) {
      setDebounced(value);
      return;
    }
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs, skip]);

  return skip ? value : debounced;
}
