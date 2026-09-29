import type { CivilDate, Client, Membership, MembershipStatusFilter } from "@/lib/domain";

export type MembershipInput = Omit<Membership, "id" | "createdAt">;
export type MembershipChanges = Partial<
  Pick<Membership, "type" | "startDate" | "endDate" | "paymentStatus">
>;

/** Una membresía con lo mínimo del cliente para pintar su fila. */
export interface MembershipWithClient {
  membership: Membership;
  client: Pick<Client, "id" | "firstName" | "lastName" | "status">;
}

/** Consulta paginada en servidor de la tabla del entrenador. */
export interface MembershipQuery {
  /** Solo las de este cliente; sin él, toda la cartera. */
  clientId?: string;
  filter: MembershipStatusFilter;
  /** Fecha civil de hoy en la zona del entrenador: «vigente» y «caduca pronto» dependen de ella. */
  today: CivilDate;
  /** Página, desde 0. */
  page: number;
  pageSize: number;
}

export interface MembershipPage {
  /** Solo la página pedida. Orden: cliente por nombre y luego inicio descendente. */
  rows: MembershipWithClient[];
  /** Cuántas hay por corte dentro del cliente elegido, sin paginar: los contadores de los chips. */
  counts: Record<MembershipStatusFilter, number>;
  /** Ids de las filas de la página que se solapan con otra del mismo cliente, esté o no en la página. */
  overlappingIds: string[];
}

export interface MembershipPort {
  /** Una página de membresías con su cliente, más contadores y solapes, en una sola consulta. */
  listMembershipsWithClients(trainerId: string, query: MembershipQuery): Promise<MembershipPage>;
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
