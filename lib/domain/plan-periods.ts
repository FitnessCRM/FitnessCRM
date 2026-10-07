import { civilDateInTimeZone, civilDaysBetween } from "./week";
import type { CivilDate, DayType, Menu, Routine, TimeZone } from "./schemas";

/**
 * Cuándo estuvo vigente un plan. El dominio no guarda la fecha de activación ni la de archivado,
 * solo `createdAt` y `updatedAt`, así que se DEDUCEN: un plan se archiva en el mismo instante en
 * que se activa el siguiente (§7), y lo activo no se edita en sitio, de modo que `updatedAt` de un
 * plan archivado es cuándo se archivó y el de uno activo es cuándo se activó.
 *
 * Cada plan archivado va, pues, desde que se archivó el anterior hasta que se archivó él. Es una
 * aproximación en dos casos: el primer plan de un cliente, cuya activación no consta (se usa su
 * fecha de creación), y un hueco sin plan, si el anterior se archivó sin que lo sustituyera otro
 * (el plan figura como vigente desde ese archivado).
 */
export interface PlanPeriod {
  /** Primer día vigente (inclusive). */
  from: CivilDate;
  /** Último día vigente (inclusive); `null` = sigue en uso. */
  to: CivilDate | null;
}

export interface RoutinePeriod extends PlanPeriod {
  routine: Routine;
}

export interface MenuSetPeriod extends PlanPeriod {
  dayType: DayType;
  /** Los menús del tipo de día que se activaron y archivaron a la vez. */
  menus: Menu[];
}

/** ¿Se solapa el periodo del plan con los días `start`–`end` (ambos inclusive)? */
export function planOverlaps(period: PlanPeriod, start: CivilDate, end: CivilDate): boolean {
  return period.from <= end && (period.to === null || period.to >= start);
}

/**
 * Días que lleva (o llevó) vigente un plan: de `from` a `to`, o a `today` si sigue en uso. Es la
 * diferencia entre las dos fechas, así que el día del relevo no cuenta dos veces (el plan que sale
 * y el que entra lo comparten) y un plan activado y archivado el mismo día da 0.
 */
export function planDays(period: PlanPeriod, today: CivilDate): number {
  return Math.max(0, civilDaysBetween(period.from, period.to ?? today));
}

/**
 * Los días en que cambió algún plan: cuando se archivó uno (el que lo sustituye entra ese mismo día,
 * §7). De más antiguo a más reciente, sin repetir aunque cambien a la vez la rutina y los menús.
 */
export function planChangeDays(periods: readonly PlanPeriod[]): CivilDate[] {
  const days = periods.flatMap((p) => (p.to === null ? [] : [p.to]));
  return [...new Set(days)].sort();
}

/**
 * Línea de tiempo de las rutinas de un cliente, sin borradores (no llegaron a estar vigentes), de la
 * más antigua a la más reciente.
 */
export function routinePeriods(routines: readonly Routine[], timeZone: TimeZone): RoutinePeriod[] {
  const day = (instant: string) => civilDateInTimeZone(instant, timeZone);
  const archived = routines
    .filter((r) => r.status === "archivado")
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  const periods: RoutinePeriod[] = [];
  let previousEnd: CivilDate | null = null;
  for (const routine of archived) {
    const to = day(routine.updatedAt);
    const from = previousEnd !== null && previousEnd <= to ? previousEnd : day(routine.createdAt);
    periods.push({ routine, from: from <= to ? from : to, to });
    previousEnd = to;
  }
  for (const routine of routines.filter((r) => r.status === "activo")) {
    periods.push({ routine, from: day(routine.updatedAt), to: null });
  }
  return periods;
}

/**
 * Línea de tiempo de los menús de un cliente, por tipo de día. Los menús de un tipo de día se
 * activan y se archivan juntos (§7), así que forman un conjunto: los archivados a la vez van
 * juntos, y los activos son el conjunto vigente. De más antiguo a más reciente en cada tipo.
 */
export function menuSetPeriods(menus: readonly Menu[], timeZone: TimeZone): MenuSetPeriod[] {
  const day = (instant: string) => civilDateInTimeZone(instant, timeZone);
  const dayTypes = [...new Set(menus.map((m) => m.dayType))];
  const periods: MenuSetPeriod[] = [];
  for (const dayType of dayTypes) {
    const ofType = menus.filter((m) => m.dayType === dayType);
    const sets = new Map<string, Menu[]>();
    for (const menu of ofType.filter((m) => m.status === "archivado")) {
      sets.set(menu.updatedAt, [...(sets.get(menu.updatedAt) ?? []), menu]);
    }
    let previousEnd: CivilDate | null = null;
    for (const [archivedAt, group] of [...sets].sort(([a], [b]) => a.localeCompare(b))) {
      const to = day(archivedAt);
      const created = day(group.map((m) => m.createdAt).sort()[0]!);
      const from = previousEnd !== null && previousEnd <= to ? previousEnd : created;
      periods.push({ dayType, menus: group, from: from <= to ? from : to, to });
      previousEnd = to;
    }
    const active = ofType.filter((m) => m.status === "activo");
    if (active.length > 0) {
      const activatedAt = active.map((m) => m.updatedAt).sort()[0]!;
      periods.push({ dayType, menus: active, from: day(activatedAt), to: null });
    }
  }
  return periods;
}
