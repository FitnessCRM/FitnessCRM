import type {
  CivilDate,
  Client,
  Membership,
  MembershipRate,
  MembershipStatusFilter,
  PriceCents,
} from "@/lib/domain";

/**
 * El registro manual (S6). El precio cobrado es opcional (tarjeta 127): lo escribe el entrenador, a
 * partir del de la tarifa, y sin él la membresía queda sin precio. El id del pago solo lo pone un
 * pago en línea confirmado (I21, I34), nunca el entrenador.
 */
export type MembershipInput = Omit<
  Membership,
  "id" | "createdAt" | "priceCents" | "onlinePaymentId"
> & { priceCents?: PriceCents | null };
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
  /** Solo la página pedida. Orden: inicio más reciente primero (`compareMembershipsForList`). */
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
  /**
   * Las cuatro tarifas del entrenador (E1), en el orden de los tipos; las que no tienen fila llegan
   * inactivas y sin precio. Las lee también su cliente, para elegir qué pagar.
   */
  listRates(trainerId: string): Promise<MembershipRate[]>;
  /** Guarda la tarifa de un tipo (E1). Solo el entrenador; el precio, en céntimos enteros (E3). */
  saveRate(rate: MembershipRate): Promise<MembershipRate>;
}
