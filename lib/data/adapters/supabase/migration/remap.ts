import type { ExportedAccount, ExportedDocument } from "./people";
import { accountIdFor, clientIdFor } from "./ids";

export interface PeopleInput {
  trainers: ExportedDocument[];
  clients: ExportedDocument[];
  accounts: ExportedAccount[];
}

const withFields = (value: unknown, fields: Record<string, unknown>): unknown =>
  typeof value === "object" && value !== null ? { ...value, ...fields } : value;

/**
 * Reescribe los ids de Firebase de entrenadores, clientes y cuentas a ids de Supabase, antes de
 * validar nada. Así el plan trabaja ya con los uuid que se van a escribir, y el uid de un
 * entrenador sigue siendo el id de su fila.
 */
export function remapPeople({ trainers, clients, accounts }: PeopleInput): PeopleInput {
  return {
    trainers: trainers.map((doc) => {
      const id = accountIdFor(doc.id);
      return { id, data: withFields(doc.data, { id }) };
    }),
    clients: clients.map((doc) => {
      const id = clientIdFor(doc.id);
      const data = doc.data as { trainerId?: unknown } | null;
      const trainerId =
        typeof data?.trainerId === "string" ? accountIdFor(data.trainerId) : data?.trainerId;
      return { id, data: withFields(doc.data, { id, trainerId }) };
    }),
    accounts: accounts.map((account) => ({ uid: accountIdFor(account.uid), email: account.email })),
  };
}
