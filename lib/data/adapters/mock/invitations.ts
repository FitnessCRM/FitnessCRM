import type { InvitationPort, Session } from "@/lib/data/ports";
import { DomainError } from "@/lib/domain";
import { invitationKind } from "@/lib/domain/invitation-link";
import { findOwn } from "./helpers";
import type { MockContext } from "./store";

/** Enlace de invitación de la demo: no sale de la memoria, pero respeta el mismo contrato. */
export const MOCK_INVITATION_LINK = "https://mock.invalid/accept-invite?invite=1";

/** El de un entrenador: como el que envía la administración, dice `kind=trainer`. */
export const MOCK_TRAINER_INVITATION_LINK =
  "https://mock.invalid/accept-invite?invite=1&kind=trainer";

export function createInvitationPort(ctx: MockContext): InvitationPort {
  /**
   * El alta de un entrenador: necesita una invitación pendiente para el correo, y que el correo no
   * sea ya de alguien con cuenta (un entrenador, o un cliente que ya aceptó la suya).
   */
  const acceptTrainerInvitation = (email: string): Promise<Session> => {
    const normalized = email.trim().toLowerCase();
    const invitation = ctx.state.trainerInvitations.find(
      (i) => i.status === "invitado" && i.email === normalized,
    );
    if (!invitation) {
      throw new DomainError(
        "invitation.not_found",
        "Ninguna invitación de entrenador pendiente tiene ese correo",
      );
    }
    const registered =
      ctx.state.trainers.some((t) => t.email.toLowerCase() === normalized) ||
      ctx.state.clients.some(
        (c) => c.status !== "invitado" && c.email.toLowerCase() === normalized,
      );
    if (registered) {
      throw new DomainError("invitation.already_registered", "El correo ya tiene cuenta en la app");
    }
    const now = ctx.now();
    const id = ctx.newId();
    ctx.state.trainers.push({
      id,
      name: invitation.name,
      email: invitation.email,
      timeZone: invitation.timeZone,
      createdAt: now,
    });
    Object.assign(invitation, { status: "aceptada", trainerId: id, acceptedAt: now });
    ctx.state.session = { trainerId: id, clientId: null, role: "trainer" };
    return ctx.reply(ctx.state.session);
  };

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
    // La demo no sabe a quién va el enlace: el correo lo escribe quien lo abre, como con Firebase.
    readInvitation: async (link) => {
      if (!link.includes("invite=")) {
        throw new DomainError("invitation.invalid_link", "El enlace no es de invitación");
      }
      return ctx.reply({ email: null });
    },
    acceptInvitation: async ({ link, email }) => {
      if (!link.includes("invite=")) {
        throw new DomainError("invitation.invalid_link", "El enlace no es de invitación");
      }
      if (email === undefined) {
        throw new DomainError("invitation.email_required", "Falta el correo de la invitación");
      }
      if (invitationKind(link) === "trainer") return acceptTrainerInvitation(email);
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
