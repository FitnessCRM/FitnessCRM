import type { Client, Membership } from "@/lib/domain";

export type MembershipInput = Omit<Membership, "id" | "createdAt">;
export type MembershipChanges = Partial<
  Pick<Membership, "type" | "startDate" | "endDate" | "paymentStatus">
>;

/** Una membresía con lo mínimo del cliente para pintar su fila. */
export interface MembershipWithClient {
  membership: Membership;
  client: Pick<Client, "id" | "firstName" | "lastName" | "status">;
}

export interface MembershipPort {
  /** Membresías de la cartera con su cliente, en una sola consulta. Orden: cliente y luego inicio descendente. */
  listMembershipsWithClients(trainerId: string): Promise<MembershipWithClient[]>;
  /** Todas las membresías de la cartera, para la pantalla del entrenador. */
  listMemberships(trainerId: string): Promise<Membership[]>;
  /** Historial completo de un cliente, más reciente primero (§7). */
  listClientMemberships(trainerId: string, clientId: string): Promise<Membership[]>;
  createMembership(input: MembershipInput): Promise<Membership>;
  updateMembership(
    trainerId: string,
    membershipId: string,
    changes: MembershipChanges,
  ): Promise<Membership>;
}
