import type { OnlinePaymentPort } from "@/lib/data/ports";
import {
  assertPayable,
  civilDateInTimeZone,
  DomainError,
  membershipFromPayment,
  membershipSchema,
} from "@/lib/domain";
import type { MockContext } from "./store";

/**
 * Pago en línea en la demo (tarjeta 125). No hay proveedor: conectar marca la cuenta como lista y
 * pagar hace en el acto lo que en producción hace la confirmación del pago, crear la membresía
 * pagada (E6), y vuelve a la pantalla Membresía como si se volviera del pago.
 */
export function createOnlinePaymentPort(ctx: MockContext): OnlinePaymentPort {
  return {
    getStatus: async (trainerId) => {
      const connected = ctx.state.onlinePaymentsConnected.includes(trainerId);
      return ctx.reply({ connected, enabled: connected });
    },
    startConnection: async (trainerId) => {
      if (!ctx.state.onlinePaymentsConnected.includes(trainerId)) {
        ctx.state.onlinePaymentsConnected.push(trainerId);
      }
      return ctx.reply({ url: "/memberships?stripe=return" });
    },
    startCheckout: async (type) => {
      const { trainerId, clientId } = ctx.state.session;
      const client = ctx.state.clients.find((c) => c.id === clientId && c.trainerId === trainerId);
      const trainer = ctx.state.trainers.find((t) => t.id === trainerId);
      if (!client || !trainer) throw new DomainError("not_found", "Cliente no encontrado");
      const rate = ctx.state.membershipRates.find(
        (r) => r.trainerId === trainerId && r.type === type,
      );
      const amountCents = assertPayable(
        client,
        rate,
        ctx.state.onlinePaymentsConnected.includes(trainerId),
      );
      const now = ctx.now();
      const made = membershipFromPayment({
        trainerId,
        clientId: client.id,
        type,
        amountCents,
        paymentId: `demo_${ctx.newId()}`,
        paidOn: civilDateInTimeZone(new Date(now), trainer.timeZone),
        existing: ctx.state.memberships.filter((m) => m.clientId === client.id),
      });
      ctx.state.memberships.push(
        membershipSchema.parse({ ...made, id: ctx.newId(), createdAt: now }),
      );
      return ctx.reply({ url: "/membership?payment=success" });
    },
  };
}
