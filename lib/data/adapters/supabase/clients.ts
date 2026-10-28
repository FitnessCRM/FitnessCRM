import type { ClientChanges, ClientInput, ClientPort } from "@/lib/data/ports";
import {
  assertClientStatusChange,
  clientSchema,
  type Client,
  type ClientStatus,
} from "@/lib/domain";
import type { SupabaseClient } from "./client";
import { notFoundError, raise } from "./errors";
import { countOf, rowsOf } from "./queries";
import { CLIENT_COLUMNS, clientFromRow, clientTrackingFromRow, type ClientRow } from "./rows";

/** Lo que escribe el entrenador al dar de alta: sin identidad ni estado, que los pone el adaptador. */
const clientInputSchema = clientSchema.omit({ id: true, createdAt: true, status: true });

/**
 * Solo las columnas de los campos que llegan: un cambio parcial no pisa lo que se cambió a la vez
 * (como `updateDoc` en Firebase).
 */
function clientColumns(data: Partial<Omit<Client, "id" | "trainerId" | "createdAt">>) {
  return {
    ...(data.firstName !== undefined && { first_name: data.firstName }),
    ...(data.lastName !== undefined && { last_name: data.lastName }),
    ...(data.email !== undefined && { email: data.email }),
    ...(data.phone !== undefined && { phone: data.phone }),
    ...(data.goal !== undefined && { goal: data.goal }),
    ...(data.level !== undefined && { level: data.level }),
    ...(data.initialNotes !== undefined && { initial_notes: data.initialNotes }),
    ...(data.status !== undefined && { status: data.status }),
    ...(data.startDate !== undefined && { start_date: data.startDate }),
    ...(data.reviewCadence !== undefined && { review_every_days: data.reviewCadence.everyDays }),
    ...(data.macrosVisible !== undefined && { macros_visible: data.macrosVisible }),
  };
}

/** Un cliente que no existe o que la sesión no ve (RLS) es `not_found`, igual que en Firebase. */
async function readClient(client: SupabaseClient, clientId: string): Promise<Client> {
  const { data, error } = await client
    .from("clients")
    .select(CLIENT_COLUMNS)
    .eq("id", clientId)
    .maybeSingle();
  raise(error);
  if (!data) throw notFoundError("Cliente");
  return clientFromRow(data as ClientRow);
}

export function createClientPort(client: SupabaseClient): ClientPort {
  return {
    listClients: (trainerId) =>
      rowsOf(
        client
          .from("clients")
          .select(CLIENT_COLUMNS)
          .eq("trainer_id", trainerId)
          .order("first_name"),
        clientFromRow,
      ),

    // Página y conteos en servidor: la función filtra, ordena y pagina (migración paged_reads).
    listClientsTracking: async (trainerId, query) => {
      const countWithStatus = (status?: ClientStatus) => {
        const scoped = client
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("trainer_id", trainerId);
        const byClient = query.clientId ? scoped.eq("id", query.clientId) : scoped;
        return countOf(status ? byClient.eq("status", status) : byClient);
      };

      const [todos, invitado, activo, dadoDeBaja, rows] = await Promise.all([
        countWithStatus(),
        countWithStatus("invitado"),
        countWithStatus("activo"),
        countWithStatus("dado_de_baja"),
        rowsOf(
          client.rpc("list_clients_tracking", {
            p_trainer_id: trainerId,
            p_filter: query.filter,
            p_client_id: query.clientId ?? null,
            p_today: query.today,
            p_page: query.page,
            p_page_size: query.pageSize,
          }),
          clientTrackingFromRow,
        ),
      ]);
      return { rows, counts: { todos, invitado, activo, dado_de_baja: dadoDeBaja } };
    },

    getClient: async (trainerId, clientId) => {
      const { data, error } = await client
        .from("clients")
        .select(CLIENT_COLUMNS)
        .eq("trainer_id", trainerId)
        .eq("id", clientId)
        .maybeSingle();
      raise(error);
      return data ? clientFromRow(data as ClientRow) : null;
    },

    // Un cliente nace siempre `invitado` (§7): pasar a `activo` es entrar con la invitación.
    createClient: async (input: ClientInput) => {
      const data = clientInputSchema.parse(input);
      const { data: row, error } = await client
        .from("clients")
        .insert({ ...clientColumns(data), trainer_id: data.trainerId, status: "invitado" })
        .select(CLIENT_COLUMNS)
        .single();
      raise(error);
      return clientFromRow(row as ClientRow);
    },

    updateClient: async (trainerId, clientId, changes: ClientChanges) => {
      const current = await readClient(client, clientId);
      if (changes.status) assertClientStatusChange(current.status, changes.status);
      // Valida la ficha entera antes de escribir: lo que llega debe cumplir el dominio tal cual.
      clientSchema.parse({ ...current, ...changes });

      const { data, error } = await client
        .from("clients")
        .update(clientColumns(changes))
        .eq("trainer_id", trainerId)
        .eq("id", clientId)
        .select(CLIENT_COLUMNS)
        .maybeSingle();
      raise(error);
      if (!data) throw notFoundError("Cliente");
      return clientFromRow(data as ClientRow);
    },

    // I11: solo `macrosVisible`, por la RPC. Las comprobaciones (cliente de la sesión y ficha
    // activa) están en la función; un rechazo llega como `client.not_writable`.
    setMacrosVisible: async (clientId, visible) => {
      const { error } = await client.rpc("set_macros_visible", {
        p_client_id: clientId,
        p_visible: visible,
      });
      if (error?.message === "client.not_writable") throw notFoundError("Cliente");
      raise(error);
      return readClient(client, clientId);
    },
  };
}
