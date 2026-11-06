// Webhook de Stripe Connect (E6, S10; tarjeta 125). Verifica la firma con `STRIPE_WEBHOOK_SECRET` y
// solo entonces actúa: un Checkout pagado crea la membresía (record_online_payment, idempotente por el
// id del pago) y un `account.updated` dice si el entrenador ya puede cobrar. Lo demás se ignora con un
// 200, para que Stripe no lo reintente.
import Stripe from "npm:stripe@17.7.0";
import { serviceHeaders, SUPABASE_URL } from "../_shared/http.ts";
import { actionForEvent, type StripeEventLike } from "../_shared/stripe-events.ts";

const cryptoProvider = Stripe.createSubtleCryptoProvider();

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  if (!secretKey || !webhookSecret) return json(500, { code: "payment.misconfigured" });
  if (request.method !== "POST") return json(405, { code: "method_not_allowed" });

  const signature = request.headers.get("Stripe-Signature") ?? "";
  const payload = await request.text();
  let event: StripeEventLike;
  try {
    const stripe = new Stripe(secretKey);
    event = (await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider,
    )) as unknown as StripeEventLike;
  } catch {
    return json(400, { code: "payment.invalid_signature" });
  }

  const action = actionForEvent(event);
  if (action.kind === "ignore") return json(200, { ignored: action.reason });

  if (action.kind === "account_updated") {
    const update = await fetch(
      `${SUPABASE_URL}/rest/v1/trainer_payment_accounts?stripe_account_id=eq.${encodeURIComponent(action.accountId)}`,
      {
        method: "PATCH",
        headers: { ...serviceHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ charges_enabled: action.chargesEnabled }),
      },
    );
    return update.ok
      ? json(200, { ok: true })
      : json(500, { code: "payment.account_update_failed" });
  }

  const { payment } = action;
  const recorded = await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_online_payment`, {
    method: "POST",
    headers: { ...serviceHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_payment_id: payment.paymentId,
      p_stripe_account_id: payment.accountId,
      p_client_id: payment.clientId,
      p_type: payment.type,
      p_amount_cents: payment.amountCents,
      p_paid_at: payment.paidAt,
    }),
  });
  // Un fallo devuelve 500 y Stripe reintenta; repetir es seguro porque el registro es idempotente.
  return recorded.ok ? json(200, { ok: true }) : json(500, { code: "payment.record_failed" });
});
