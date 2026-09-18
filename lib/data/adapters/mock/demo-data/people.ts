import type { Client, Membership, Trainer } from "@/lib/domain";
import { CLIENT_IDS, DEMO_TZ, TRAINER_ID, ts } from "./common";

export const trainer: Trainer = {
  id: TRAINER_ID,
  name: "Adrián Vega",
  email: "adrian@hector.app",
  timeZone: DEMO_TZ,
  createdAt: ts("2026-01-10"),
};

function client(
  id: string,
  firstName: string,
  lastName: string,
  startDate: string,
  extra: Partial<Client> = {},
): Client {
  return {
    id,
    trainerId: TRAINER_ID,
    firstName,
    lastName,
    email: `${firstName.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()}@email.com`,
    phone: "",
    goal: "",
    level: "",
    initialNotes: "",
    status: "activo",
    startDate,
    reviewCadence: { everyDays: 7 },
    createdAt: ts(startDate),
    ...extra,
  };
}

/** Semanas de la maqueta: Marta S5, Jorge S8, Sara S3, David S11 el 29-08-2026. */
export const clients: Client[] = [
  client(CLIENT_IDS.marta, "Marta", "Ruiz", "2026-08-01", {
    phone: "+34 600 111 222",
    goal: "Hipertrofia",
    level: "Intermedio",
  }),
  client(CLIENT_IDS.jorge, "Jorge", "Lema", "2026-07-11", {
    goal: "Definición",
    level: "Avanzado",
  }),
  client(CLIENT_IDS.sara, "Sara", "Peña", "2026-08-15", {
    lastName: "Peña Ortiz",
    phone: "+34 612 345 678",
    goal: "Recomposición corporal",
    level: "Intermedio",
  }),
  client(CLIENT_IDS.david, "David", "Cano", "2026-06-20", {
    goal: "Hipertrofia",
    level: "Intermedio",
  }),
  client(CLIENT_IDS.lucia, "Lucía", "Torres", "2026-05-02", {
    status: "dado_de_baja",
    initialNotes: "Pausa por viaje largo",
  }),
];

let n = 0;
function membership(
  clientId: string,
  type: Membership["type"],
  startDate: string,
  endDate: string,
  paymentStatus: Membership["paymentStatus"],
): Membership {
  return {
    id: `mb-${++n}`,
    trainerId: TRAINER_ID,
    clientId,
    type,
    startDate,
    endDate,
    paymentStatus,
    createdAt: ts(startDate),
  };
}

export const memberships: Membership[] = [
  membership(CLIENT_IDS.marta, "mensual", "2026-02-01", "2026-02-28", "pagada"),
  membership(CLIENT_IDS.marta, "mensual", "2026-03-01", "2026-03-31", "pagada"),
  membership(CLIENT_IDS.marta, "trimestral", "2026-04-01", "2026-06-30", "pagada"),
  membership(CLIENT_IDS.marta, "trimestral", "2026-07-01", "2026-09-30", "pagada"),
  membership(CLIENT_IDS.marta, "trimestral", "2026-10-01", "2026-12-31", "no_pagada"),
  membership(CLIENT_IDS.jorge, "mensual", "2026-08-01", "2026-08-31", "pagada"),
  membership(CLIENT_IDS.jorge, "mensual", "2026-09-01", "2026-09-30", "no_pagada"),
  membership(CLIENT_IDS.sara, "mensual", "2026-08-15", "2026-09-14", "pagada"),
  membership(CLIENT_IDS.david, "semestral", "2026-05-01", "2026-10-31", "pagada"),
  membership(CLIENT_IDS.lucia, "mensual", "2026-08-01", "2026-08-31", "no_pagada"),
];
