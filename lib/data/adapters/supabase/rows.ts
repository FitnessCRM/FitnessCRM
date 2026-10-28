import type { ClientTrackingRow } from "@/lib/data/ports";
import {
  clientSchema,
  clientStatusSchema,
  membershipSchema,
  type Client,
  type Membership,
} from "@/lib/domain";

/** Columnas que leen los puertos: solo las que el dominio necesita. */
export const CLIENT_COLUMNS =
  "id, trainer_id, first_name, last_name, email, phone, goal, level, initial_notes, status, start_date, review_every_days, macros_visible, created_at";

export const MEMBERSHIP_COLUMNS =
  "id, trainer_id, client_id, type, start_date, end_date, payment_status, created_at";

/** Fila de `public.clients` tal como la devuelve PostgREST. */
export interface ClientRow {
  id: string;
  trainer_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  goal: string;
  level: string;
  initial_notes: string;
  status: string;
  start_date: string;
  review_every_days: number;
  macros_visible: boolean;
  created_at: string;
}

/** Fila de `public.memberships`. */
export interface MembershipRow {
  id: string;
  trainer_id: string;
  client_id: string;
  type: string;
  start_date: string;
  end_date: string;
  payment_status: string;
  created_at: string;
}

/** Fila de `list_clients_tracking`: la ficha, lo que suma la función y la membresía vigente hoy. */
export interface ClientTrackingDbRow extends ClientRow {
  routine_name: string | null;
  new_review_week: number | null;
  last_review_at: string | null;
  current_membership: MembershipRow | null;
}

/** Fila de `list_memberships_with_clients`: la membresía, su cliente y si se solapa con otra. */
export interface MembershipPageRow extends MembershipRow {
  client_first_name: string;
  client_last_name: string;
  client_status: string;
  overlapping: boolean;
}

/**
 * `timestamptz` llega con desfase (`+00:00`) y el dominio pide ISO con `Z`: se normaliza con
 * `toISOString`. Las fechas `date` llegan ya como `YYYY-MM-DD`, que es lo que el dominio quiere.
 */
const isoOf = (value: string) => new Date(value).toISOString();

export function clientFromRow(row: ClientRow): Client {
  return clientSchema.parse({
    id: row.id,
    trainerId: row.trainer_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    goal: row.goal,
    level: row.level,
    initialNotes: row.initial_notes,
    status: row.status,
    startDate: row.start_date,
    reviewCadence: { everyDays: row.review_every_days },
    macrosVisible: row.macros_visible,
    createdAt: isoOf(row.created_at),
  });
}

export function clientTrackingFromRow(row: ClientTrackingDbRow): ClientTrackingRow {
  return {
    client: clientFromRow(row),
    routineName: row.routine_name,
    newReviewWeek: row.new_review_week,
    lastReviewAt: row.last_review_at === null ? null : isoOf(row.last_review_at),
    membership: row.current_membership ? membershipFromRow(row.current_membership) : null,
  };
}

export function membershipFromRow(row: MembershipRow): Membership {
  return membershipSchema.parse({
    id: row.id,
    trainerId: row.trainer_id,
    clientId: row.client_id,
    type: row.type,
    startDate: row.start_date,
    endDate: row.end_date,
    paymentStatus: row.payment_status,
    createdAt: isoOf(row.created_at),
  });
}

export function membershipPageFromRow(row: MembershipPageRow) {
  return {
    membership: membershipFromRow(row),
    client: {
      id: row.client_id,
      firstName: row.client_first_name,
      lastName: row.client_last_name,
      status: clientStatusSchema.parse(row.client_status),
    },
    overlapping: row.overlapping,
  };
}
