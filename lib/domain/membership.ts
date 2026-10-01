import { addCivilDays, civilDaysBetween } from "./week";
import type { CivilDate, Membership, MembershipType } from "./schemas";

const MONTHS_PER_TYPE: Record<MembershipType, number> = {
  mensual: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

/**
 * Último día de una membresía que empieza en `startDate`: los meses de su tipo menos un día, con
 * los extremos incluidos (trimestral desde el 01-09 acaba el 30-11 y la siguiente empieza el
 * 01-12). Si el mes de destino es más corto se queda en su último día. Solo propone un fin: el
 * entrenador puede corregirlo, y el esquema solo exige que no sea anterior al inicio.
 */
export function membershipEndDate(type: MembershipType, startDate: CivilDate): CivilDate {
  const [y, m, d] = startDate.split("-").map(Number) as [number, number, number];
  const target = m - 1 + MONTHS_PER_TYPE[type];
  const lastDayOfTarget = new Date(Date.UTC(y, target + 1, 0)).getUTCDate();
  const next = new Date(Date.UTC(y, target, Math.min(d, lastDayOfTarget)))
    .toISOString()
    .slice(0, 10);
  return addCivilDays(next, -1);
}

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

/** Los tres cortes de la tabla del entrenador. */
export type MembershipStatusFilter = "all" | "unpaid" | "expiring";

export function matchesMembershipFilter(
  membership: Membership,
  filter: MembershipStatusFilter,
  today: CivilDate,
): boolean {
  if (filter === "unpaid") return membership.paymentStatus === "no_pagada";
  if (filter === "expiring") return isExpiringSoon(membership, today);
  return true;
}

/**
 * Inicio que se propone para una renovación: el día siguiente al fin de la última membresía del
 * cliente, o hoy si ya venció o no tiene ninguna. Solo propone: el entrenador puede cambiarlo.
 */
export function suggestedRenewalStart(
  memberships: readonly Membership[],
  today: CivilDate,
): CivilDate {
  const lastEnd = memberships.reduce<CivilDate | null>(
    (latest, m) => (latest === null || m.endDate > latest ? m.endDate : latest),
    null,
  );
  if (lastEnd === null) return today;
  const next = addCivilDays(lastEnd, 1);
  return next > today ? next : today;
}

/** Si un periodo se pisa con alguna de las membresías (extremos incluidos, como en el solape). */
export function overlapsAnyMembership(
  memberships: readonly Membership[],
  period: { startDate: CivilDate; endDate: CivilDate },
): boolean {
  return memberships.some((m) => period.startDate <= m.endDate && m.startDate <= period.endDate);
}
