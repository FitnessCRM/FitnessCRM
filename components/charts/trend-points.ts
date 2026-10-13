export interface TrendPoint {
  /** Etiqueta del eje X ("S1", "1 ago"). */
  label: string;
  /** `null` = hueco: la línea se corta, nunca se interpola (semana saltada, pesaje ausente). */
  [key: string]: string | number | null;
}

/**
 * Un valor sin ningún vecino con dato (ni antes ni después) no tiene línea que lo una: se pinta
 * como punto, o no se vería. Un hueco nunca se pinta.
 */
export function isIsolated(data: TrendPoint[], key: string, index: number): boolean {
  const hasValue = (i: number) => data[i]?.[key] != null;
  return hasValue(index) && !hasValue(index - 1) && !hasValue(index + 1);
}
