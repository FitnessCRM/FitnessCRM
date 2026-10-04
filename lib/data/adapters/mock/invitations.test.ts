import { describe, expect, it } from "vitest";
import { createMockPorts } from "./index";
import { MOCK_INVITATION_LINK } from "./invitations";
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
