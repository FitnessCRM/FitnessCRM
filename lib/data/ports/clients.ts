import type { CivilDate, Client, ClientStatus, IsoTimestamp, Membership } from "@/lib/domain";

/**
 * Datos que aporta el entrenador al dar de alta. El resto lo pone el adaptador: `id`, `createdAt`
 * y `status`, porque un cliente nace siempre `invitado` (§7) y pasar a `activo` es otra operación.
 */
export type ClientInput = Omit<Client, "id" | "createdAt" | "status">;
export type ClientChanges = Partial<Omit<Client, "id" | "createdAt" | "trainerId">>;

/**
 * Corte por estado del seguimiento de clientes: los tres estados del dominio (§7). «Inactivo» no
 * existe; la usan Clientes y el panel de control.
 */
export type ClientTrackingFilter = "todos" | ClientStatus;

/** Consulta paginada en servidor del seguimiento de clientes (`/clients`). */
export interface ClientTrackingQuery {
  filter: ClientTrackingFilter;
  /** Solo este cliente; sin él, toda la cartera. Como en la tabla de Membresías. */
  clientId?: string;
  /** Fecha civil de hoy en la zona del entrenador: «membresía vigente» depende de ella. */
  today: CivilDate;
  /** Página, desde 0. */
  page: number;
  pageSize: number;
}

/** Un cliente con lo que el entrenador necesita ver de un vistazo. */
export interface ClientTrackingRow {
  client: Client;
  /** Nombre de la rutina activa: el plan que sigue. `null` si no tiene. */
  routineName: string | null;
  /** Semana de la revisión pendiente de ver (`enviada`), si la hay. */
  newReviewWeek: number | null;
  /**
   * Cuándo envió su última revisión, sea cual sea hoy su estado (`enviada`, `vista` o `revisada`).
   * Los borradores no cuentan: no se han enviado. `null` si nunca ha enviado ninguna.
   */
  lastReviewAt: IsoTimestamp | null;
  /** Membresía vigente hoy. */
  membership: Membership | null;
}

export interface ClientTrackingPage {
  /** Solo la página pedida. Orden: revisión nueva primero y luego nombre. */
  rows: ClientTrackingRow[];
  /** Cuántos hay por estado dentro de la búsqueda, sin paginar: los contadores de los chips. */
  counts: Record<ClientTrackingFilter, number>;
}

export interface ClientPort {
  /** Lista completa de clientes (para lecturas que no necesitan paginación). */
  listClients(trainerId: string): Promise<Client[]>;
  /**
   * Página del seguimiento de clientes: filtra, busca, ordena y pagina en servidor. Sus contadores
   * por estado son también las cifras de clientes del panel de control.
   */
  listClientsTracking(trainerId: string, query: ClientTrackingQuery): Promise<ClientTrackingPage>;
  getClient(trainerId: string, clientId: string): Promise<Client | null>;
  createClient(input: ClientInput): Promise<Client>;
  updateClient(trainerId: string, clientId: string, changes: ClientChanges): Promise<Client>;
}
