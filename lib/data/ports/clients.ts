import type { Client } from "@/lib/domain";

/** Datos que aporta el entrenador al dar de alta. El resto (id, createdAt) lo pone el adaptador. */
export type ClientInput = Omit<Client, "id" | "createdAt">;
export type ClientChanges = Partial<Omit<ClientInput, "trainerId">>;

export interface ClientPort {
  listClients(trainerId: string): Promise<Client[]>;
  getClient(trainerId: string, clientId: string): Promise<Client | null>;
  createClient(input: ClientInput): Promise<Client>;
  updateClient(trainerId: string, clientId: string, changes: ClientChanges): Promise<Client>;
}
