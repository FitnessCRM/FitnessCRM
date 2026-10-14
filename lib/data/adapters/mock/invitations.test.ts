import { describe, expect, it } from "vitest";
import { createMockPorts } from "./index";
import { MOCK_INVITATION_LINK, MOCK_TRAINER_INVITATION_LINK } from "./invitations";
import { CLIENT_IDS, TRAINER_ID } from "./demo-data/common";

describe("mock: invitation of a client", () => {
  const invite = () => {
    const ports = createMockPorts();
    const client = ports.state.clients.find((c) => c.id === CLIENT_IDS.sara)!;
    client.status = "invitado";
    return { ports, client };
  };

  it("only invites an own client who has not entered yet", async () => {
    const { ports, client } = invite();
    await expect(ports.invitations.sendInvitation(TRAINER_ID, client.id)).resolves.toBeUndefined();
    await expect(ports.invitations.sendInvitation("t-otra", client.id)).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(
      ports.invitations.sendInvitation(TRAINER_ID, CLIENT_IDS.marta),
    ).rejects.toMatchObject({ code: "invitation.not_invited" });
  });

  it("accepting activates the client and opens their session", async () => {
    const { ports, client } = invite();
    const session = await ports.invitations.acceptInvitation({
      email: client.email.toUpperCase(),
      link: MOCK_INVITATION_LINK,
      password: "secreto-1",
    });
    expect(session).toEqual({ trainerId: TRAINER_ID, clientId: client.id, role: "client" });
    expect((await ports.clients.getClient(TRAINER_ID, client.id))?.status).toBe("activo");
    expect(await ports.session.getSession()).toEqual(session);
  });

  it("rejects an email nobody invited and a link that is not an invitation", async () => {
    const { ports } = invite();
    await expect(
      ports.invitations.acceptInvitation({
        email: "nadie@email.com",
        link: MOCK_INVITATION_LINK,
        password: "secreto-1",
      }),
    ).rejects.toMatchObject({ code: "invitation.not_found" });
    await expect(
      ports.invitations.acceptInvitation({
        email: "sara@email.com",
        link: "https://mock.invalid/login",
        password: "secreto-1",
      }),
    ).rejects.toMatchObject({ code: "invitation.invalid_link" });
    expect(ports.invitations.isInvitationLink("https://mock.invalid/login")).toBe(false);
  });
});

describe("mock: invitation of a trainer", () => {
  const NOW = "2026-10-14T10:00:00.000Z";
  const invite = (email = "nueva@entrena.test") => {
    const ports = createMockPorts({ now: () => NOW });
    ports.state.trainerInvitations.push({
      email,
      name: "Nueva Entrenadora",
      timeZone: "Europe/Madrid",
      status: "invitado",
      createdAt: "2026-10-13T08:00:00.000Z",
    });
    return ports;
  };

  it("accepting creates the trainer, accepts the invitation and opens a trainer session", async () => {
    const ports = invite();
    expect(ports.invitations.isInvitationLink(MOCK_TRAINER_INVITATION_LINK)).toBe(true);
    const session = await ports.invitations.acceptInvitation({
      email: " NUEVA@entrena.test ",
      link: MOCK_TRAINER_INVITATION_LINK,
      password: "secreto-1",
    });
    expect(session).toEqual({ trainerId: expect.any(String), clientId: null, role: "trainer" });
    expect(await ports.trainer.getTrainer(session.trainerId)).toEqual({
      id: session.trainerId,
      name: "Nueva Entrenadora",
      email: "nueva@entrena.test",
      timeZone: "Europe/Madrid",
      createdAt: NOW,
    });
    expect(ports.state.trainerInvitations[0]).toMatchObject({
      status: "aceptada",
      trainerId: session.trainerId,
      acceptedAt: NOW,
    });
    expect(await ports.session.getSession()).toEqual(session);
  });

  it("without a pending invitation for the email there is no trainer", async () => {
    const ports = invite();
    const trainers = ports.state.trainers.length;
    await expect(
      ports.invitations.acceptInvitation({
        email: "otra@entrena.test",
        link: MOCK_TRAINER_INVITATION_LINK,
        password: "secreto-1",
      }),
    ).rejects.toMatchObject({ code: "invitation.not_found" });
    ports.state.trainerInvitations[0]!.status = "aceptada";
    await expect(
      ports.invitations.acceptInvitation({
        email: "nueva@entrena.test",
        link: MOCK_TRAINER_INVITATION_LINK,
        password: "secreto-1",
      }),
    ).rejects.toMatchObject({ code: "invitation.not_found" });
    expect(ports.state.trainers).toHaveLength(trainers);
  });

  it("an email that already has an account is not signed up again", async () => {
    // Marta es una clienta activa: ya tiene cuenta.
    const marta = createMockPorts().state.clients.find((c) => c.id === CLIENT_IDS.marta)!;
    const ports = invite(marta.email.toLowerCase());
    const before = await ports.session.getSession();
    await expect(
      ports.invitations.acceptInvitation({
        email: marta.email,
        link: MOCK_TRAINER_INVITATION_LINK,
        password: "secreto-1",
      }),
    ).rejects.toMatchObject({ code: "invitation.already_registered" });
    expect(ports.state.trainerInvitations[0]!.status).toBe("invitado");
    expect(await ports.session.getSession()).toEqual(before);
  });
});
