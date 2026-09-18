import { civilDateInTimeZone, type CivilDate } from "@/lib/domain";

/**
 * Formateo de presentación (no dominio): números con coma decimal y fechas `DD-MM-YYYY`.
 * Convención de CLAUDE.md: en pantalla siempre DD-MM-YYYY.
 */

const oneDecimal = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** 63.4 → "63,4" */
export function formatDecimal(value: number): string {
  return oneDecimal.format(value);
}

/** −2.1 → "−2,1" (signo menos tipográfico), 0.8 → "+0,8", 0 → "0,0" */
export function formatSignedDecimal(value: number): string {
  if (value > 0) return `+${oneDecimal.format(value)}`;
  if (value < 0) return `−${oneDecimal.format(Math.abs(value))}`;
  return oneDecimal.format(0);
}

/** "2026-08-29" → "29-08-2026" */
export function formatCivilDate(date: CivilDate): string {
  const [y, m, d] = date.split("-");
  return `${d}-${m}-${y}`;
}

/** "63,4" | "63.4" | " 63 " → 63.4; texto no numérico → NaN */
export function parseDecimalInput(raw: string): number {
  const normalized = raw.trim().replace(",", ".");
  return normalized === "" ? NaN : Number(normalized);
}

/** Fecha civil de hoy en la zona del entrenador (o la del navegador mientras no se conoce). */
export function todayCivil(timeZone?: string): CivilDate {
  return civilDateInTimeZone(
    new Date(),
    timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
}
