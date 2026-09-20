import { civilDaysBetween } from "./week";
import type { CivilDate, Membership } from "./schemas";

/**
 * Estado de la membresía de un cliente en una fecha. Solo lectura: el cobro pasa fuera de la app
 * y una renovación es una fila nueva, nunca una edición de la anterior (§7, I21).
 */
export interface MembershipStanding {
  /** La que contiene la fecha. Si varias la contienen, la que empezó más tarde. */
  current: Membership | null;
  /** La primera que empieza después de la fecha. */
  next: Membership | null;
  /** Días civiles que faltan para el fin de la actual, 0 el último día. */
  daysLeft: number | null;
  /** Parte transcurrida de la actual, entre 0 y 1, para la barra. */
  elapsed: number | null;
}

const byStart = (a: Membership, b: Membership) =>
  a.startDate.localeCompare(b.startDate) || a.createdAt.localeCompare(b.createdAt);

export function membershipStanding(
  memberships: readonly Membership[],
  today: CivilDate,
): MembershipStanding {
  const sorted = [...memberships].sort(byStart);
  const current = sorted.filter((m) => m.startDate <= today && today <= m.endDate).at(-1) ?? null;
  const next = sorted.find((m) => m.startDate > today) ?? null;
  if (!current) return { current, next, daysLeft: null, elapsed: null };

  const total = civilDaysBetween(current.startDate, current.endDate);
  const done = civilDaysBetween(current.startDate, today);
  return {
    current,
    next,
    daysLeft: civilDaysBetween(today, current.endDate),
    elapsed: total === 0 ? 1 : Math.min(1, Math.max(0, done / total)),
  };
}

/** Historial completo, de la más reciente a la más antigua: es lo que el cliente lee (§7). */
export function membershipHistory(memberships: readonly Membership[]): Membership[] {
  return [...memberships].sort((a, b) => -byStart(a, b));
}
