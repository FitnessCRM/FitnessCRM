import type { InvitationPort } from "@/lib/data/ports";
import { DomainError } from "@/lib/domain";
import { findOwn } from "./helpers";
import type { MockContext } from "./store";

/** Enlace de invitación de la demo: no sale de la memoria, pero respeta el mismo contrato. */
export const MOCK_INVITATION_LINK = "https://mock.invalid/accept-invite?invite=1";

export function createInvitationPort(ctx: MockContext): InvitationPort {
  return {
    sendInvitation: async (trainerId, clientId) => {
      const client = findOwn(ctx.state.clients, trainerId, clientId, "Cliente");
      if (client.status !== "invitado") {
        throw new DomainError(
          "invitation.not_invited",
          "El cliente ya no está pendiente de entrar",
        );
      }
      return ctx.reply(undefined);
    },
    isInvitationLink: (link) => link.includes("invite="),
    acceptInvitation: async ({ email, link }) => {
      if (!link.includes("invite=")) {
        throw new DomainError("invitation.invalid_link", "El enlace no es de invitación");
      }
      const client = ctx.state.clients.find(
        (c) => c.status === "invitado" && c.email.toLowerCase() === email.trim().toLowerCase(),
      );
      if (!client) {
        throw new DomainError("invitation.not_found", "Ningún cliente invitado tiene ese correo");
      }
      client.status = "activo";
      ctx.state.session = { trainerId: client.trainerId, clientId: client.id, role: "client" };
      return ctx.reply(ctx.state.session);
    },
  };
}
