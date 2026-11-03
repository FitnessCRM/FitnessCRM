import type { MembershipType } from "@/lib/domain";

/** Estado del cobro en línea de un entrenador (E5). */
export interface OnlinePaymentStatus {
  /** Ha empezado a conectar su cuenta de cobro. */
  connected: boolean;
  /** Puede cobrar ya: sin esto, el cliente no ve el botón de pagar. */
  enabled: boolean;
}

/**
 * Pago en línea de membresías, del cliente al entrenador (tarjeta 125, docs/dominio.md §12). El
 * puerto no sabe de qué proveedor es: lo específico vive detrás del adaptador (S7). La membresía no
 * la crea ninguno de estos métodos: la crea la confirmación del pago, cuando llega (E6, I34).
 */
export interface OnlinePaymentPort {
  /** Si el entrenador puede cobrar en línea. Lo pregunta él mismo o su cliente activo. */
  getStatus(trainerId: string): Promise<OnlinePaymentStatus>;
  /** El entrenador conecta (o retoma) su cuenta de cobro. Devuelve adónde llevarle. */
  startConnection(trainerId: string): Promise<{ url: string }>;
  /**
   * El cliente de la sesión empieza a pagar una tarifa (E5, I35). Devuelve adónde llevarle para
   * pagar. `payment.client_not_active`, `payment.not_enabled` o `payment.rate_not_payable` si no
   * se puede.
   */
  startCheckout(type: MembershipType): Promise<{ url: string }>;
}
