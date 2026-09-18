import type { CivilDate, Review, WeightLog } from "./schemas";
import { addCivilDays, reviewWindowForWeek } from "./week";

/** Los kg se enseñan con un decimal; las cifras derivadas se redondean aquí, no en la UI. */
export const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Ventana de la "media 7 días": los 7 días civiles que terminan en el último pesaje. */
export const AVERAGE_WINDOW_DAYS = 7;
/** Con un solo pesaje no hay media: hacen falta al menos dos en la ventana. */
export const MIN_LOGS_FOR_AVERAGE = 2;

const byDateThenCreated = (a: WeightLog, b: WeightLog) =>
  a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);

/** Último pesaje: fecha más reciente y, a igual fecha, el creado más tarde. */
export function latestWeightLog(logs: readonly WeightLog[]): WeightLog | null {
  return logs.length ? [...logs].sort(byDateThenCreated).at(-1)! : null;
}

/** Primer pesaje registrado: es el "inicio" de "desde inicio". */
export function earliestWeightLog(logs: readonly WeightLog[]): WeightLog | null {
  return logs.length ? [...logs].sort(byDateThenCreated)[0]! : null;
}

/**
 * Media 7 días = media de los pesajes de los 7 días civiles que terminan en el último pesaje
 * (ambos inclusive). Se ancla al último pesaje y no a "hoy" para que la cifra no desaparezca
 * cuando el cliente lleva días sin pesarse. `null` si hay menos de 2 pesajes en esa ventana.
 */
export function sevenDayAverage(logs: readonly WeightLog[]): number | null {
  const latest = latestWeightLog(logs);
  if (!latest) return null;
  const from = addCivilDays(latest.date, -(AVERAGE_WINDOW_DAYS - 1));
  const inWindow = logs.filter((l) => l.date >= from && l.date <= latest.date);
  if (inWindow.length < MIN_LOGS_FOR_AVERAGE) return null;
  return round1(inWindow.reduce((sum, l) => sum + l.weightKg, 0) / inWindow.length);
}

/**
 * Desde inicio = último pesaje − primer pesaje registrado (no la fecha de alta: sin pesaje
 * inicial no hay punto de partida). `null` con menos de 2 pesajes. Negativo = ha bajado.
 */
export function changeSinceStart(logs: readonly WeightLog[]): number | null {
  const latest = latestWeightLog(logs);
  const first = earliestWeightLog(logs);
  if (!latest || !first || latest.id === first.id) return null;
  return round1(latest.weightKg - first.weightKg);
}

export interface WeightSummary {
  latest: WeightLog | null;
  sevenDayAverage: number | null;
  changeSinceStart: number | null;
}

/** Las tres cifras de la pantalla de peso, con una sola definición. */
export function weightSummary(logs: readonly WeightLog[]): WeightSummary {
  return {
    latest: latestWeightLog(logs),
    sevenDayAverage: sevenDayAverage(logs),
    changeSinceStart: changeSinceStart(logs),
  };
}

export interface WeeklyWeightPoint {
  week: number;
  /** Último pesaje de la semana, o `null` si no hubo: la gráfica lo pinta como hueco. */
  weightKg: number | null;
  date: CivilDate | null;
}

/** Un punto por semana del cliente, de `fromWeek` a `toWeek`, con el último pesaje de cada una. */
export function weeklyWeights(
  logs: readonly WeightLog[],
  startDate: CivilDate,
  fromWeek: number,
  toWeek: number,
): WeeklyWeightPoint[] {
  const points: WeeklyWeightPoint[] = [];
  for (let week = Math.max(1, fromWeek); week <= toWeek; week++) {
    const window = reviewWindowForWeek(startDate, week);
    const latest = latestWeightLog(
      logs.filter((l) => l.date >= window.start && l.date <= window.end),
    );
    points.push({ week, weightKg: latest?.weightKg ?? null, date: latest?.date ?? null });
  }
  return points;
}

/** Rango de las últimas `count` semanas terminando en la actual; nunca baja de la semana 1. */
export function lastWeeksRange(currentWeek: number, count = 6): { from: number; to: number } {
  return { from: Math.max(1, currentWeek - count + 1), to: Math.max(1, currentWeek) };
}

/** La revisión que usa este pesaje como su peso (I9), si la hay: "día de revisión". */
export function reviewUsingWeightLog(
  log: Pick<WeightLog, "id">,
  reviews: readonly Review[],
): Review | null {
  return reviews.find((r) => r.weightLogId === log.id) ?? null;
}
