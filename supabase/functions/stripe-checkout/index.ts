// El cliente empieza a pagar una membresía (E5, S3, S5; tarjeta 125). Un pago único, en EUR, con
// cargo directo en la cuenta del entrenador y sin comisión de la plataforma. La sesión no crea nada en
// la base de datos: la membresía la crea el webhook cuando Stripe confirma el pago (E6).
// Se vuelve a comprobar aquí todo lo que dice I35, con los datos de la base y no con lo que manda la
// app: cliente activo, entrenador con la cuenta lista y tarifa activa con precio.
import Stripe from "npm:stripe@17.7.0";
import { appUrl, callerProfile, responder, selectRows } from "../_shared/http.ts";

const TYPES = ["mensual", "trimestral", "semestral", "anual"];
const PRODUCT_NAME: Record<string, string> = {
  mensual: "Membresía mensual",
  trimestral: "Membresía trimestral",
  semestral: "Membresía semestral",
  anual: "Membresía anual",
};

Deno.serve(async (request) => {
  const app = appUrl();
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!app || !secretKey) {
    return new Response(JSON.stringify({ code: "payment.misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { corsHeaders, reply } = responder(app);
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return reply(405, { code: "method_not_allowed" });

  const body = (await request.json().catch(() => null)) as { type?: unknown } | null;
  const type = typeof body?.type === "string" && TYPES.includes(body.type) ? body.type : null;
  if (!type) return reply(400, { code: "payment.invalid_request" });

  const caller = await callerProfile(request.headers.get("Authorization") ?? "");
  if (!caller || caller.role !== "client" || !caller.clientId || !caller.trainerId) {
    return reply(401, { code: "session.unauthorized" });
  }
  const { clientId, trainerId } = caller;

  // Con la clave de servicio: la cuenta conectada no la lee nadie más.
  const [clients, accounts, rates] = await Promise.all([
    selectRows<{ status: string }>(
      `clients?select=status&id=eq.${encodeURIComponent(clientId)}&trainer_id=eq.${encodeURIComponent(trainerId)}`,
    ),
    selectRows<{ stripe_account_id: string; charges_enabled: boolean }>(
      `trainer_payment_accounts?select=stripe_account_id,charges_enabled&trainer_id=eq.${encodeURIComponent(trainerId)}`,
    ),
    selectRows<{ active: boolean; price_cents: number | null }>(
      `membership_rates?select=active,price_cents&trainer_id=eq.${encodeURIComponent(trainerId)}&type=eq.${type}`,
    ),
  ]);
  if (clients === null || accounts === null || rates === null) {
    return reply(502, { code: "payment.checkout_failed" });
  }
  if (clients[0]?.status !== "activo") return reply(409, { code: "payment.client_not_active" });
  const account = accounts[0];
  if (!account?.charges_enabled) return reply(409, { code: "payment.not_enabled" });
  const rate = rates[0];
  if (!rate?.active || !rate.price_cents) return reply(409, { code: "payment.rate_not_payable" });

  try {
    const stripe = new Stripe(secretKey);
    const metadata = { client_id: clientId, trainer_id: trainerId, membership_type: type };
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        currency: "eur",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: rate.price_cents,
              product_data: { name: PRODUCT_NAME[type] ?? type },
            },
          },
        ],
        client_reference_id: clientId,
        customer_email: caller.email ?? undefined,
        metadata,
        payment_intent_data: { metadata },
        success_url: `${app}/membership?payment=success`,
        cancel_url: `${app}/membership?payment=cancelled`,
      },
      // Cargo directo: la sesión vive en la cuenta del entrenador, que es el comercio (S5).
      { stripeAccount: account.stripe_account_id },
    );
    if (!session.url) return reply(502, { code: "payment.checkout_failed" });
    return reply(200, { url: session.url });
  } catch {
    return reply(502, { code: "payment.checkout_failed" });
  }
});
