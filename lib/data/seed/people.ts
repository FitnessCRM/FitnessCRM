import {
  addCivilDays,
  clientSchema,
  membershipEndDate,
  membershipSchema,
  trainerSchema,
  type CivilDate,
  type Client,
  type IsoTimestamp,
  type Membership,
  type MembershipType,
  type PaymentStatus,
  type TimeZone,
  type Trainer,
} from "@/lib/domain";
import type { SeedContext } from "./library";
import { at } from "./time";

export const DEFAULT_TIME_ZONE: TimeZone = "Europe/Madrid";

export type ClientKey = "lucas" | "irene";

interface ClientSpec {
  firstName: string;
  lastName: string;
  goal: string;
  level: string;
  /** Días entre el alta y el ancla. */
  startDaysAgo: number;
}

/**
 * Objetivo y nivel salen de las listas del formulario de alta (`es.clientData.goals` y `.levels`):
 * son texto libre en el dominio, pero así el desplegable de «Editar datos» los enseña como una de
 * sus opciones. Un test comprueba que siguen en esas listas.
 */
export const CLIENT_SPECS: Record<ClientKey, ClientSpec> = {
  lucas: {
    firstName: "Lucas",
    lastName: "Navarro",
    goal: "Ganancia muscular",
    level: "Nivel medio",
    startDaysAgo: 40,
  },
  irene: {
    firstName: "Irene",
    lastName: "Soto",
    goal: "Pérdida de grasa",
    level: "Nivel avanzado",
    startDaysAgo: 63,
  },
};

export const CLIENT_KEYS = Object.keys(CLIENT_SPECS) as ClientKey[];

/** El id de un cliente sembrado: no depende de la fecha, así que se puede buscar antes de sembrar. */
export const seedClientId = (prefix: string, key: ClientKey): string => `${prefix}${key}`;

/**
 * El ancla que corresponde a un cliente ya sembrado. Las fechas son relativas al día de la primera
 * siembra, y los ids de pesajes y series llevan la fecha: si una segunda ejecución usara «hoy», lo
 * duplicaría todo con un día de desfase. Por eso el ancla se deduce de lo que ya está escrito.
 */
export function anchorFromStartDate(key: ClientKey, startDate: CivilDate): CivilDate {
  return addCivilDays(startDate, CLIENT_SPECS[key].startDaysAgo);
}

/**
 * Los dos clientes, ya `activo`: es el estado en que deja a un cliente aceptar su invitación (§7,
 * §12), que la siembra no recorre porque crea ella misma la cuenta y su enlace con la ficha.
 */
export function buildClients(ctx: SeedContext): Record<ClientKey, Client> {
  const client = (key: ClientKey): Client => {
    const spec = CLIENT_SPECS[key];
    const startDate = addCivilDays(ctx.anchor, -spec.startDaysAgo);
    return clientSchema.parse({
      id: seedClientId(ctx.idPrefix, key),
      trainerId: ctx.trainerId,
      firstName: spec.firstName,
      lastName: spec.lastName,
      email: ctx.clientEmails[key],
      phone: "",
      goal: spec.goal,
      level: spec.level,
      initialNotes: "",
      status: "activo",
      startDate,
      reviewCadence: { everyDays: 7 },
      macrosVisible: true,
      createdAt: at(ctx.clock, startDate, "09:30"),
    });
  };
  return { lucas: client("lucas"), irene: client("irene") };
}

/**
 * Lucas: una mensual ya vencida y la mensual vigente, las dos pagadas y encadenadas (la segunda
 * empieza el día siguiente al fin de la primera, como propone la renovación). Irene: una trimestral
 * vigente sin pagar. Las fechas de fin salen de `membershipEndDate`, la misma regla que el alta.
 */
export function buildMemberships(
  ctx: SeedContext,
  clients: Record<ClientKey, Client>,
): Membership[] {
  const membership = (
    client: Client,
    n: number,
    type: MembershipType,
    startDate: CivilDate,
    paymentStatus: PaymentStatus,
  ): Membership =>
    membershipSchema.parse({
      id: `${client.id}-mb-${n}`,
      trainerId: ctx.trainerId,
      clientId: client.id,
      type,
      startDate,
      endDate: membershipEndDate(type, startDate),
      paymentStatus,
      createdAt: at(ctx.clock, startDate, "10:00"),
    });
  const first = membership(clients.lucas, 1, "mensual", clients.lucas.startDate, "pagada");
  return [
    first,
    membership(clients.lucas, 2, "mensual", addCivilDays(first.endDate, 1), "pagada"),
    membership(clients.irene, 1, "trimestral", clients.irene.startDate, "no_pagada"),
  ];
}

/** `trainers/{id}`, solo si falta. El nombre llega por argumento: la siembra no lo inventa. */
export function buildTrainer(input: {
  id: string;
  name: string;
  email: string;
  timeZone: TimeZone;
  now: IsoTimestamp;
}): Trainer {
  return trainerSchema.parse({
    id: input.id,
    name: input.name,
    email: input.email,
    timeZone: input.timeZone,
    createdAt: input.now,
  });
}
