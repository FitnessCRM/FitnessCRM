// Conecta la cuenta de Stripe del entrenador (S5, S7; tarjeta 125). Cuentas Standard: el entrenador es
// el comercio y lleva fraude, disputas y reembolsos desde su panel de Stripe. Crea la cuenta la
// primera vez, guarda su id (lo único de Stripe que guarda la base de datos sobre él), refresca si ya
// puede cobrar y devuelve el enlace de alta de Stripe, al que la app lleva al entrenador.
import Stripe from "npm:stripe@17.7.0";
import { serveBrowserFunction, type Reply } from "../_shared/cors.ts";
import {
  appUrl,
  callerProfile,
  selectRows,
  serviceHeaders,
  SUPABASE_URL,
} from "../_shared/http.ts";

Deno.serve((request) => {
  const app = appUrl();
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  return serveBrowserFunction(
    request,
    {
      origin: app,
      config: app && secretKey ? { app, secretKey } : null,
      misconfiguredCode: "payment.misconfigured",
      failureCode: "payment.connect_failed",
    },
    (config, reply) => connect(request, config, reply),
  );
});

async function connect(
  request: Request,
  { app, secretKey }: { app: string; secretKey: string },
  reply: Reply,
): Promise<Response> {
  const caller = await callerProfile(request.headers.get("Authorization") ?? "");
  if (!caller || caller.role !== "trainer" || !caller.trainerId) {
    return reply(401, { code: "session.unauthorized" });
  }
  const trainerId = caller.trainerId;
  const stripe = new Stripe(secretKey);

  const existing = await selectRows<{ stripe_account_id: string }>(
    `trainer_payment_accounts?select=stripe_account_id&trainer_id=eq.${encodeURIComponent(trainerId)}`,
  );
  if (existing === null) return reply(502, { code: "payment.connect_failed" });

  let accountId = existing[0]?.stripe_account_id;
  try {
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "standard",
        email: caller.email ?? undefined,
        metadata: { trainer_id: trainerId },
      });
      accountId = account.id;
    }
    const account = await stripe.accounts.retrieve(accountId);
    const saved = await fetch(`${SUPABASE_URL}/rest/v1/trainer_payment_accounts`, {
      method: "POST",
      headers: {
        ...serviceHeaders,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        trainer_id: trainerId,
        stripe_account_id: accountId,
        charges_enabled: account.charges_enabled === true,
      }),
    });
    if (!saved.ok) return reply(502, { code: "payment.connect_failed" });

    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${app}/memberships?stripe=refresh`,
      return_url: `${app}/memberships?stripe=return`,
    });
    return reply(200, { url: link.url, enabled: account.charges_enabled === true });
  } catch {
    return reply(502, { code: "payment.connect_failed" });
  }
}
