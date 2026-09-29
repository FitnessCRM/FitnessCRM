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

/** «Caduca pronto»: a la vigente le quedan como mucho estos días. */
export const EXPIRING_SOON_DAYS = 7;

/** Vigente hoy y con el fin a `EXPIRING_SOON_DAYS` días o menos. Una ya vencida no «caduca». */
export function isExpiringSoon(membership: Membership, today: CivilDate): boolean {
  if (membership.startDate > today || membership.endDate < today) return false;
  return civilDaysBetween(today, membership.endDate) <= EXPIRING_SOON_DAYS;
}

/**
 * Ids de las membresías de un mismo cliente cuyas fechas se pisan con otra suya (extremos
 * incluidos: acabar y empezar el mismo día es solapar). Hoy `membershipStanding` lo resuelve en
 * silencio quedándose con la de inicio más tardío, así que el entrenador tiene que verlo.
 */
export function overlappingMembershipIds(memberships: readonly Membership[]): Set<string> {
  const byClient = new Map<string, Membership[]>();
  for (const m of memberships) byClient.set(m.clientId, [...(byClient.get(m.clientId) ?? []), m]);

  const overlapping = new Set<string>();
  for (const group of byClient.values()) {
    const sorted = [...group].sort(byStart);
    let reach: Membership | null = null; // la que llega más lejos de las ya vistas
    for (const m of sorted) {
      if (reach && m.startDate <= reach.endDate) {
        overlapping.add(m.id);
        overlapping.add(reach.id);
      }
      if (!reach || m.endDate > reach.endDate) reach = m;
    }
  }
  return overlapping;
}
