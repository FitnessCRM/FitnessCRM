import type { Membership } from "@/lib/domain";

export type MembershipInput = Omit<Membership, "id" | "createdAt">;
export type MembershipChanges = Partial<
  Pick<Membership, "type" | "startDate" | "endDate" | "paymentStatus">
>;

export interface MembershipPort {
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
