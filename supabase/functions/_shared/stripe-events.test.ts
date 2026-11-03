// Tests del webhook de Stripe sin claves (S9, S10): eventos de ejemplo, firmados y verificados con un
// secreto que genera el propio test, con la librería oficial `stripe`. Ninguna llamada a la red.
import { randomBytes } from "node:crypto";
import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { actionForEvent, type StripeEventLike } from "./stripe-events";

const stripe = new Stripe("sk_test_not_a_real_key");
const secret = `whsec_${randomBytes(24).toString("hex")}`;

function sessionCompleted(
  overrides: Record<string, unknown> = {},
  event: Partial<StripeEventLike> = {},
) {
  return {
    id: "evt_test_1",
    object: "event",
    type: "checkout.session.completed",
    account: "acct_test_trainer",
    created: 1_793_700_000,
    data: {
      object: {
        id: "cs_test_1",
        object: "checkout.session",
        mode: "payment",
        payment_status: "paid",
        payment_intent: "pi_test_1",
        amount_total: 4900,
        currency: "eur",
        metadata: { client_id: "client-1", trainer_id: "trainer-1", membership_type: "mensual" },
        ...overrides,
      },
    },
    ...event,
  };
}

/** Lo que haría el webhook: verificar la firma con el secreto y, si vale, decidir la acción. */
function receive(payload: string, header: string, key = secret) {
  const event = stripe.webhooks.constructEvent(payload, header, key) as unknown as StripeEventLike;
  return actionForEvent(event);
}

describe("stripe webhook · signature (S10)", () => {
  it("accepts an event signed with the endpoint secret", () => {
    const payload = JSON.stringify(sessionCompleted());
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(receive(payload, header).kind).toBe("record_payment");
  });

  it("rejects a tampered payload and a different secret", () => {
    const payload = JSON.stringify(sessionCompleted());
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    const tampered = payload.replace("4900", "1");
    expect(() => receive(tampered, header)).toThrow();
    expect(() => receive(payload, header, `whsec_${randomBytes(24).toString("hex")}`)).toThrow();
  });
});

describe("stripe webhook · what each event does (E6, I21)", () => {
  it("a paid one-off Checkout records the payment id, the amount and whose it is", () => {
    expect(actionForEvent(sessionCompleted() as StripeEventLike)).toEqual({
      kind: "record_payment",
      payment: {
        paymentId: "pi_test_1",
        accountId: "acct_test_trainer",
        clientId: "client-1",
        trainerId: "trainer-1",
        type: "mensual",
        amountCents: 4900,
        paidAt: new Date(1_793_700_000 * 1000).toISOString(),
      },
    });
  });

  it("the same event twice yields the same payment id, so the database keeps one (I34)", () => {
    const a = actionForEvent(sessionCompleted() as StripeEventLike);
    const b = actionForEvent(sessionCompleted() as StripeEventLike);
    expect(a).toEqual(b);
  });

  it("an unpaid, abandoned or recurring session leaves nothing (E6, S3)", () => {
    const ignored = [
      sessionCompleted({ payment_status: "unpaid" }),
      sessionCompleted({}, { type: "checkout.session.expired" }),
      sessionCompleted({ mode: "subscription" }),
      sessionCompleted({ currency: "usd" }),
      sessionCompleted({ metadata: { client_id: "client-1" } }),
      sessionCompleted({
        metadata: { client_id: "c", trainer_id: "t", membership_type: "bienal" },
      }),
      sessionCompleted({}, { account: null }),
    ];
    for (const event of ignored) {
      expect(actionForEvent(event as StripeEventLike).kind).toBe("ignore");
    }
  });

  it("a delayed payment that succeeds is recorded too", () => {
    const event = sessionCompleted({}, { type: "checkout.session.async_payment_succeeded" });
    expect(actionForEvent(event as StripeEventLike).kind).toBe("record_payment");
  });

  it("account updates say whether the trainer can charge", () => {
    const event = {
      id: "evt_acc",
      type: "account.updated",
      created: 1,
      data: { object: { id: "acct_test_trainer", charges_enabled: true } },
    };
    expect(actionForEvent(event)).toEqual({
      kind: "account_updated",
      accountId: "acct_test_trainer",
      chargesEnabled: true,
    });
  });
});
