// Qué hace la app con cada evento de Stripe que le llega por el webhook (tarjeta 125, docs/dominio.md
// §12). Sin imports y sin red: lo usa la Edge Function `stripe-webhook` en Deno, después de verificar
// la firma, y lo prueban los tests de Vitest con eventos de ejemplo.

/** Los cuatro tipos cerrados de membresía (E1). */
const MEMBERSHIP_TYPES = ["mensual", "trimestral", "semestral", "anual"] as const;
export type MembershipType = (typeof MEMBERSHIP_TYPES)[number];

/** Lo mínimo de un evento de Stripe que se lee aquí. */
export interface StripeEventLike {
  id: string;
  type: string;
  /** Cuenta conectada en la que pasó: con cargos directos, la del entrenador (S5). */
  account?: string | null;
  created: number;
  data: { object: Record<string, unknown> };
}

/** El pago confirmado que crea una membresía (E6, I21): solo id, importe y a quién corresponde. */
export interface ConfirmedPayment {
  paymentId: string;
  accountId: string;
  clientId: string;
  trainerId: string;
  type: MembershipType;
  amountCents: number;
  paidAt: string;
}

export type WebhookAction =
  | { kind: "record_payment"; payment: ConfirmedPayment }
  | { kind: "account_updated"; accountId: string; chargesEnabled: boolean }
  | { kind: "ignore"; reason: string };

const isString = (value: unknown): value is string => typeof value === "string" && value !== "";

/**
 * Traduce un evento ya verificado a lo que hay que hacer. Solo crea membresía un Checkout de pago
 * único (S3) completado y pagado: un pago abandonado, caducado o pendiente no deja nada (E6). Lo que
 * no se entiende se ignora, nunca se adivina.
 */
export function actionForEvent(event: StripeEventLike): WebhookAction {
  if (event.type === "account.updated") {
    const account = event.data.object;
    if (!isString(account.id)) return { kind: "ignore", reason: "account without id" };
    return {
      kind: "account_updated",
      accountId: account.id,
      chargesEnabled: account.charges_enabled === true,
    };
  }

  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  ) {
    return { kind: "ignore", reason: `event ${event.type}` };
  }

  const session = event.data.object;
  if (session.mode !== "payment") return { kind: "ignore", reason: "not a one-off payment" };
  if (session.payment_status !== "paid") return { kind: "ignore", reason: "not paid yet" };
  if (!isString(event.account)) return { kind: "ignore", reason: "not a connected account" };

  const metadata = (session.metadata ?? {}) as Record<string, unknown>;
  const type = metadata.membership_type;
  const amount = session.amount_total;
  const paymentId = isString(session.payment_intent) ? session.payment_intent : session.id;
  if (
    !isString(metadata.client_id) ||
    !isString(metadata.trainer_id) ||
    !MEMBERSHIP_TYPES.includes(type as MembershipType) ||
    typeof amount !== "number" ||
    !Number.isInteger(amount) ||
    amount <= 0 ||
    session.currency !== "eur" ||
    !isString(paymentId)
  ) {
    return { kind: "ignore", reason: "session without the expected data" };
  }

  return {
    kind: "record_payment",
    payment: {
      paymentId,
      accountId: event.account,
      clientId: metadata.client_id,
      trainerId: metadata.trainer_id,
      type: type as MembershipType,
      amountCents: amount,
      paidAt: new Date(event.created * 1000).toISOString(),
    },
  };
}
