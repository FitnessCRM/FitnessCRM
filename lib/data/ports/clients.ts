import type { Client } from "@/lib/domain";

/** Datos que aporta el entrenador al dar de alta. El resto (id, createdAt) lo pone el adaptador. */
export type ClientInput = Omit<Client, "id" | "createdAt">;
export type ClientChanges = Partial<Omit<ClientInput, "trainerId">>;

/** Estado de cliente para filtrar en dashboard. */
export type ClientStatusFilter = "activo" | "inactivo" | "todos";

/** Consulta paginada en servidor de clientes en el dashboard. */
export interface ClientQuery {
  filter: ClientStatusFilter;
  page: number;
  pageSize: number;
}

/** Página de clientes con sus datos para el dashboard. */
export interface ClientPage {
  rows: Client[];
  /** Contadores por estado. */
  counts: Record<ClientStatusFilter, number>;
}

export interface ClientPort {
  /** Lista completa de clientes (para lecturas que no necesitan paginación). */
  listClients(trainerId: string): Promise<Client[]>;
  /** Página de clientes con paginación en servidor (para el dashboard). */
  listClientsWithPagination(trainerId: string, query: ClientQuery): Promise<ClientPage>;
  getClient(trainerId: string, clientId: string): Promise<Client | null>;
  createClient(input: ClientInput): Promise<Client>;
  updateClient(trainerId: string, clientId: string, changes: ClientChanges): Promise<Client>;
}
