import type { Client, Membership, Trainer } from "@/lib/domain";
import { CLIENT_IDS, DEMO_TZ, TRAINER_ID, ts, type DemoDates } from "./common";

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

export function buildClients(d: DemoDates): Client[] {
  return [
    client(CLIENT_IDS.marta, "Marta", "Ruiz", d.martaStart, {
      phone: "+34 600 111 222",
      goal: "Hipertrofia",
      level: "Intermedio",
    }),
    client(CLIENT_IDS.jorge, "Jorge", "Lema", d.jorgeStart, {
      goal: "Definición",
      level: "Avanzado",
    }),
    client(CLIENT_IDS.sara, "Sara", "Peña", d.saraStart, {
      lastName: "Peña Ortiz",
      phone: "+34 612 345 678",
      goal: "Recomposición corporal",
      level: "Intermedio",
    }),
    client(CLIENT_IDS.david, "David", "Cano", d.davidStart, {
      goal: "Hipertrofia",
      level: "Intermedio",
    }),
    client(CLIENT_IDS.lucia, "Lucía", "Torres", d.luciaStart, {
      status: "dado_de_baja",
      initialNotes: "Pausa por viaje largo",
    }),
  ];
}

/** Membresías encadenadas hacia atrás desde la vigente; a Marta le quedan ~30 días, como en la demo. */
export function buildMemberships(d: DemoDates): Membership[] {
  let n = 0;
  const membership = (
    clientId: string,
    type: Membership["type"],
    startOffset: number,
    endOffset: number,
    paymentStatus: Membership["paymentStatus"],
  ): Membership => {
    const startDate = d.daysAhead(startOffset);
    return {
      id: `mb-${++n}`,
      trainerId: TRAINER_ID,
      clientId,
      type,
      startDate,
      endDate: d.daysAhead(endOffset),
      paymentStatus,
      createdAt: ts(startDate),
    };
  };
  return [
    membership(CLIENT_IDS.marta, "mensual", -210, -182, "pagada"),
    membership(CLIENT_IDS.marta, "mensual", -181, -151, "pagada"),
    membership(CLIENT_IDS.marta, "trimestral", -150, -60, "pagada"),
    membership(CLIENT_IDS.marta, "trimestral", -59, 30, "pagada"),
    membership(CLIENT_IDS.marta, "trimestral", 31, 122, "no_pagada"),
    membership(CLIENT_IDS.jorge, "mensual", -48, -19, "pagada"),
    membership(CLIENT_IDS.jorge, "mensual", -18, 11, "no_pagada"),
    membership(CLIENT_IDS.sara, "mensual", -15, 14, "pagada"),
    membership(CLIENT_IDS.david, "semestral", -70, 112, "pagada"),
    membership(CLIENT_IDS.lucia, "mensual", -48, -19, "no_pagada"),
  ];
}
