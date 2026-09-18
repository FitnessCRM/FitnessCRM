import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { DomainError } from "./errors";
import type { CivilDate, ReviewWindow, TimeZone } from "./schemas";

const MS_PER_DAY = 86_400_000;

/** Fecha civil → días desde la época, sin zona ni DST (se calcula en UTC a propósito). */
function civilToEpochDays(date: CivilDate): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

function epochDaysToCivil(days: number): CivilDate {
  return new Date(days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Suma días a una fecha civil. */
export function addCivilDays(date: CivilDate, days: number): CivilDate {
  return epochDaysToCivil(civilToEpochDays(date) + days);
}

/** Diferencia `b - a` en días civiles. */
export function civilDaysBetween(a: CivilDate, b: CivilDate): number {
  return civilToEpochDays(b) - civilToEpochDays(a);
}

/** Proyecta un instante a la fecha civil de la zona del entrenador. */
export function civilDateInTimeZone(instant: Date | string, timeZone: TimeZone): CivilDate {
  const ms = typeof instant === "string" ? new Date(instant).getTime() : instant.getTime();
  return format(new TZDate(ms, timeZone), "yyyy-MM-dd");
}

/**
 * Número de semana del cliente (§8):
 *   weekNumber = floor((date - startDate) / 7 días) + 1
 * `date` puede ser una fecha civil o un instante; el instante se proyecta a la zona del
 * entrenador. Una fecha anterior al alta no tiene semana: es un error de dominio.
 */
export function weekNumber(
  startDate: CivilDate,
  date: CivilDate | Date,
  timeZone: TimeZone,
): number {
  const civil = typeof date === "string" ? date : civilDateInTimeZone(date, timeZone);
  const days = civilDaysBetween(startDate, civil);
  if (days < 0) {
    throw new DomainError(
      "week.before_start",
      `La fecha ${civil} es anterior al alta ${startDate}`,
    );
  }
  return Math.floor(days / 7) + 1;
}

/** Ventana civil de una semana dada: los 7 días que empiezan en `startDate + 7·(n−1)`. */
export function reviewWindowForWeek(startDate: CivilDate, week: number): ReviewWindow {
  if (!Number.isInteger(week) || week < 1) {
    throw new DomainError("week.invalid", `Número de semana inválido: ${week}`);
  }
  const start = addCivilDays(startDate, (week - 1) * 7);
  return { start, end: addCivilDays(start, 6) };
}

/** Días que faltan hasta la próxima revisión según la cadencia orientativa. Puede ser negativo. */
export function daysUntilNextReview(
  lastReviewDate: CivilDate | null,
  startDate: CivilDate,
  everyDays: number,
  today: CivilDate,
): number {
  const from = lastReviewDate ?? startDate;
  return civilDaysBetween(today, addCivilDays(from, everyDays));
}
