import { FunctionsHttpError } from "@supabase/supabase-js";
import type { OnlinePaymentPort } from "@/lib/data/ports";
import { DomainError } from "@/lib/domain";
import type { SupabaseClient } from "./client";
import { raise } from "./errors";

/** Edge Functions del cobro en línea (supabase/functions/stripe-*): lo único que sabe de Stripe. */
const CONNECT_FUNCTION = "stripe-connect";
const CHECKOUT_FUNCTION = "stripe-checkout";

/** Las funciones devuelven `{ code }` con el código del dominio; sin él, es un fallo de conexión. */
async function failure(error: Error): Promise<Error> {
  if (!(error instanceof FunctionsHttpError)) return error;
  const body = (await error.context.json().catch(() => null)) as { code?: unknown } | null;
  return typeof body?.code === "string" ? new DomainError(body.code, body.code) : error;
}

async function urlFrom(
  client: SupabaseClient,
  name: string,
  body: Record<string, unknown>,
): Promise<{ url: string }> {
  const { data, error } = await client.functions.invoke(name, { body });
  if (error) throw await failure(error);
  const url = (data as { url?: unknown } | null)?.url;
  if (typeof url !== "string") throw new Error(`${name} no devolvió adónde ir`);
  return { url };
}

/**
 * Pago en línea (tarjeta 125). El estado sale de la base (`online_payment_status`, que comprueba
 * quién pregunta); conectar la cuenta y abrir el pago, de las Edge Functions. La membresía la crea
 * el webhook al confirmarse el pago, no este adaptador (E6).
 */
export function createOnlinePaymentPort(client: SupabaseClient): OnlinePaymentPort {
  return {
    getStatus: async (trainerId) => {
      const { data, error } = await client.rpc("online_payment_status", {
        p_trainer_id: trainerId,
      });
      raise(error);
      const row = (data as { connected: boolean; enabled: boolean }[] | null)?.[0];
      return { connected: row?.connected ?? false, enabled: row?.enabled ?? false };
    },
    startConnection: () => urlFrom(client, CONNECT_FUNCTION, {}),
    startCheckout: (type) => urlFrom(client, CHECKOUT_FUNCTION, { type }),
  };
}
