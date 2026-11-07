import { describe, expect, it } from "vitest";
import { planPeople, type ExportedAccount, type ExportedDocument } from "./people";

const TRAINER_UID = "uid-trainer-1";
const CLIENT_ACCOUNT = "uid-client-1";

const trainer: ExportedDocument = {
  id: TRAINER_UID,
  data: {
    id: TRAINER_UID,
    name: "Entrenador de prueba",
    email: "trainer@example.com",
    timeZone: "Europe/Madrid",
    createdAt: "2026-08-01T09:00:00.000Z",
  },
};

const client = (id: string, email: string, status = "activo"): ExportedDocument => ({
  id,
  data: {
    id,
    trainerId: TRAINER_UID,
    firstName: "Cliente",
    lastName: "De prueba",
    email,
    phone: "",
    goal: "",
    level: "",
    initialNotes: "",
    status,
    startDate: "2026-08-03",
    reviewCadence: { everyDays: 7 },
    macrosVisible: true,
    createdAt: "2026-08-03T09:00:00.000Z",
  },
});

const account = (uid: string, email: string | null): ExportedAccount => ({ uid, email });

describe("planPeople", () => {
  it("keeps the trainer's auth uid as its id and links its profile", () => {
    const plan = planPeople({
      trainers: [trainer],
      clients: [],
      accounts: [account(TRAINER_UID, "trainer@example.com")],
    });
    expect(plan.trainers).toEqual([
      {
        id: TRAINER_UID,
        name: "Entrenador de prueba",
        email: "trainer@example.com",
        time_zone: "Europe/Madrid",
        created_at: "2026-08-01T09:00:00.000Z",
      },
    ]);
    expect(plan.profiles).toEqual([
      { user_id: TRAINER_UID, role: "trainer", trainer_id: TRAINER_UID, client_id: null },
    ]);
  });

  it("links a client account by email, with the client's trainer and id", () => {
    const plan = planPeople({
      trainers: [trainer],
      clients: [client("client-doc-1", "Client@Example.com ")],
      accounts: [account(CLIENT_ACCOUNT, "client@example.com")],
    });
    expect(plan.profiles).toEqual([
      {
        user_id: CLIENT_ACCOUNT,
        role: "client",
        trainer_id: TRAINER_UID,
        client_id: "client-doc-1",
      },
    ]);
    expect(plan.clients[0]).toMatchObject({
      id: "client-doc-1",
      trainer_id: TRAINER_UID,
      review_every_days: 7,
      start_date: "2026-08-03",
      macros_visible: true,
    });
  });

  it("reports accounts without a record and clients without an account", () => {
    const plan = planPeople({
      trainers: [trainer],
      clients: [
        client("client-doc-1", "linked@example.com"),
        client("client-doc-2", "pending@example.com", "invitado"),
      ],
      accounts: [
        account(CLIENT_ACCOUNT, "linked@example.com"),
        account("uid-orphan", "orphan@example.com"),
      ],
    });
    expect(plan.unlinkedAccountUids).toEqual(["uid-orphan"]);
    expect(plan.clientsWithoutAccount).toEqual(["client-doc-2"]);
    expect(plan.clients.find((row) => row.id === "client-doc-2")?.status).toBe("invitado");
  });

  describe("M1", () => {
    const plan = () =>
      planPeople({
        trainers: [trainer],
        clients: [
          client("client-linked", "linked@example.com"),
          client("client-active-no-account", "active@example.com"),
          client("client-invited", "invited@example.com", "invitado"),
          client("client-discharged", "gone@example.com", "dado_de_baja"),
        ],
        accounts: [
          account(TRAINER_UID, "trainer@example.com"),
          account(CLIENT_ACCOUNT, "linked@example.com"),
          account("uid-orphan", "orphan@example.com"),
        ],
      });
    const statusOf = (id: string) => plan().clients.find((row) => row.id === id)?.status;

    it("loads an active client without an auth account as invited, without profile", () => {
      expect(statusOf("client-active-no-account")).toBe("invitado");
      expect(plan().profiles.map((p) => p.client_id)).not.toContain("client-active-no-account");
      expect(plan().clientsMovedToInvited).toEqual(["client-active-no-account"]);
    });

    it("leaves them ready to resend the invitation, with the ones already invited", () => {
      expect(plan().clientsToInvite).toEqual(["client-active-no-account", "client-invited"]);
      expect(statusOf("client-invited")).toBe("invitado");
    });

    it("keeps a discharged client without account discharged, and does not invite them", () => {
      expect(statusOf("client-discharged")).toBe("dado_de_baja");
      expect(plan().clientsToInvite).not.toContain("client-discharged");
    });

    it("keeps a client with an account in the state it had", () => {
      expect(statusOf("client-linked")).toBe("activo");
    });

    it("leaves out an auth account without a record, and reports it by uid", () => {
      expect(plan().unlinkedAccountUids).toEqual(["uid-orphan"]);
      expect(plan().profiles.map((p) => p.user_id)).not.toContain("uid-orphan");
    });
  });

  it("refuses a document that does not match the domain schema, naming only its id", () => {
    const broken = client("client-broken", "broken@example.com");
    (broken.data as { email: string }).email = "not-an-email";
    expect(() => planPeople({ trainers: [trainer], clients: [broken], accounts: [] })).toThrow(
      /client-broken/,
    );
  });

  it("refuses an account whose email belongs to a trainer with another uid", () => {
    expect(() =>
      planPeople({
        trainers: [trainer],
        clients: [],
        accounts: [account("uid-other", "trainer@example.com")],
      }),
    ).toThrow(/uid-other/);
  });
});
