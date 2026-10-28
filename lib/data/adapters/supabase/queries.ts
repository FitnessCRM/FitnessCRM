import type { Client } from "@/lib/domain";
import type { SupabaseClient } from "./client";
import { notFoundError, raise, type BackendError } from "./errors";
import { CLIENT_COLUMNS, MEMBERSHIP_COLUMNS, clientFromRow, type ClientRow } from "./rows";

/** Lo que el adaptador usa de una respuesta de PostgREST. */
interface QueryResult {
  data: unknown;
  error: BackendError | null;
}

interface CountResult {
  count: number | null;
  error: BackendError | null;
}

/** Filas de una consulta, ya mapeadas al dominio. Un error de la consulta sale como excepción. */
export async function rowsOf<Row, Out>(
  query: PromiseLike<QueryResult>,
  map: (row: Row) => Out,
): Promise<Out[]> {
  const { data, error } = await query;
  raise(error);
  return ((data ?? []) as Row[]).map(map);
}

export async function countOf(query: PromiseLike<CountResult>): Promise<number> {
  const { count, error } = await query;
  raise(error);
  return count ?? 0;
}

// Cada función devuelve un builder nuevo: PostgREST acumula los filtros en el mismo objeto, así que
// reutilizar una consulta mezclaría los filtros de las dos.

export const membershipsQuery = (client: SupabaseClient, trainerId: string) =>
  client.from("memberships").select(MEMBERSHIP_COLUMNS).eq("trainer_id", trainerId);

export const membershipsCount = (client: SupabaseClient, trainerId: string) =>
  client
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("trainer_id", trainerId);

/** Un cliente del entrenador, o `not_found`. Sus fechas las usan las semanas y los pesajes. */
export async function readClient(
  client: SupabaseClient,
  trainerId: string,
  clientId: string,
): Promise<Client> {
  const { data, error } = await client
    .from("clients")
    .select(CLIENT_COLUMNS)
    .eq("trainer_id", trainerId)
    .eq("id", clientId)
    .maybeSingle();
  raise(error);
  if (!data) throw notFoundError("Cliente");
  return clientFromRow(data as ClientRow);
}

/** La zona horaria del entrenador: de ella salen «hoy», la semana y las fechas válidas (I27). */
export async function timeZoneOf(client: SupabaseClient, trainerId: string): Promise<string> {
  const { data, error } = await client
    .from("trainers")
    .select("time_zone")
    .eq("id", trainerId)
    .maybeSingle();
  raise(error);
  if (!data) throw notFoundError("Entrenador");
  return (data as { time_zone: string }).time_zone;
}
