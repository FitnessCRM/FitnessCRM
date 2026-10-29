import { clientSchema } from "@/lib/domain/schemas/client";
import { trainerSchema } from "@/lib/domain/schemas/trainer";

/**
 * Entrenadores, clientes y sus perfiles, tal como van a Supabase (tarjeta 119, Fase 8). Es puro: no
 * habla con la red ni con el SDK. El cargador lo usa para decidir qué escribir y en qué orden.
 *
 * Las filas se validan con los esquemas de `lib/domain` antes de salir de aquí. Si un documento no
 * cumple, se aborta con su id, nunca con sus datos.
 */

/** Un documento exportado: el id aparte y los campos tal cual los guardó la app de Firebase. */
export interface ExportedDocument {
  id: string;
  data: unknown;
}

/** Una cuenta de Auth exportada, sin hash ni salt (ver `export-data.ts`). */
export interface ExportedAccount {
  uid: string;
  email: string | null;
}

export interface TrainerRow {
  id: string;
  name: string;
  email: string;
  time_zone: string;
  created_at: string;
}

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
  status: "invitado" | "activo" | "dado_de_baja";
  start_date: string;
  review_every_days: number;
  macros_visible: boolean;
  created_at: string;
}

export interface ProfileRow {
  user_id: string;
  role: "trainer" | "client";
  trainer_id: string;
  client_id: string | null;
}

export interface PeoplePlan {
  trainers: TrainerRow[];
  clients: ClientRow[];
  /** Un perfil por cuenta enlazada. Las cuentas sin entrenador ni cliente no tienen perfil. */
  profiles: ProfileRow[];
  /** Cuentas de Auth que no son de ningún entrenador ni cliente exportado. */
  unlinkedAccountUids: string[];
  /** Clientes sin cuenta de Auth: su ficha se carga igual, sin perfil. */
  clientsWithoutAccount: string[];
}

const normalize = (email: string | null | undefined): string => (email ?? "").trim().toLowerCase();

function parseOrAbort<T>(
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  id: string,
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error(`El documento ${id} no cumple el esquema del dominio.`);
  return result.data;
}

/**
 * Empareja las cuentas con sus fichas. Una cuenta es de entrenador si su uid es el id de un
 * entrenador; si no, es de cliente si su correo es el de una ficha de cliente. El uid de entrenador
 * se conserva porque `trainers.id` referencia a `auth.users`.
 */
export function planPeople({
  trainers,
  clients,
  accounts,
}: {
  trainers: ExportedDocument[];
  clients: ExportedDocument[];
  accounts: ExportedAccount[];
}): PeoplePlan {
  const trainerRows = trainers.map((doc) => {
    const trainer = parseOrAbort(trainerSchema, doc.id, doc.data);
    return {
      id: trainer.id,
      name: trainer.name,
      email: trainer.email,
      time_zone: trainer.timeZone,
      created_at: trainer.createdAt,
    };
  });

  const clientRecords = clients.map((doc) => parseOrAbort(clientSchema, doc.id, doc.data));
  const clientRows: ClientRow[] = clientRecords.map((client) => ({
    id: client.id,
    trainer_id: client.trainerId,
    first_name: client.firstName,
    last_name: client.lastName,
    email: client.email,
    phone: client.phone,
    goal: client.goal,
    level: client.level,
    initial_notes: client.initialNotes,
    status: client.status,
    start_date: client.startDate,
    review_every_days: client.reviewCadence.everyDays,
    macros_visible: client.macrosVisible,
    created_at: client.createdAt,
  }));

  const trainerIds = new Set(trainerRows.map((row) => row.id));
  const trainerByEmail = new Map(trainerRows.map((row) => [normalize(row.email), row.id]));
  const clientByEmail = new Map(clientRows.map((row) => [normalize(row.email), row]));

  const profiles: ProfileRow[] = [];
  const linkedClientIds = new Set<string>();
  const unlinkedAccountUids: string[] = [];

  for (const account of accounts) {
    if (trainerIds.has(account.uid)) {
      profiles.push({
        user_id: account.uid,
        role: "trainer",
        trainer_id: account.uid,
        client_id: null,
      });
      continue;
    }
    const client = clientByEmail.get(normalize(account.email));
    if (client && !linkedClientIds.has(client.id)) {
      linkedClientIds.add(client.id);
      profiles.push({
        user_id: account.uid,
        role: "client",
        trainer_id: client.trainer_id,
        client_id: client.id,
      });
      continue;
    }
    unlinkedAccountUids.push(account.uid);
  }

  // Una cuenta de entrenador con correo de entrenador que no coincide con su uid: lo que sea que
  // haya pasado, no se adivina. Se avisa con el uid, nunca con el correo.
  for (const account of accounts) {
    const byEmail = trainerByEmail.get(normalize(account.email));
    if (byEmail !== undefined && byEmail !== account.uid) {
      throw new Error(`La cuenta ${account.uid} comparte correo con un entrenador de otro uid.`);
    }
  }

  return {
    trainers: trainerRows,
    clients: clientRows,
    profiles,
    unlinkedAccountUids,
    clientsWithoutAccount: clientRows.map((row) => row.id).filter((id) => !linkedClientIds.has(id)),
  };
}
