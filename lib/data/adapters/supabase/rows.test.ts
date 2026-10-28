import { describe, expect, it } from "vitest";
import {
  clientFromRow,
  clientTrackingFromRow,
  membershipFromRow,
  membershipPageFromRow,
  type ClientRow,
  type ClientTrackingDbRow,
  type MembershipPageRow,
  type MembershipRow,
} from "./rows";

const TRAINER = "11111111-1111-1111-1111-111111111111";
const CLIENT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const MEMBERSHIP = "cccccccc-cccc-cccc-cccc-cccccccccccc";

const clientRow: ClientRow = {
  id: CLIENT,
  trainer_id: TRAINER,
  first_name: "Marta",
  last_name: "Ruiz",
  email: "marta@test.local",
  phone: "",
  goal: "Definir",
  level: "",
  initial_notes: "",
  status: "activo",
  start_date: "2026-01-12",
  review_every_days: 7,
  macros_visible: false,
  created_at: "2026-01-12T09:00:00.500000+00:00",
};

const membershipRow: MembershipRow = {
  id: MEMBERSHIP,
  trainer_id: TRAINER,
  client_id: CLIENT,
  type: "trimestral",
  start_date: "2026-09-01",
  end_date: "2026-11-30",
  payment_status: "pagada",
  created_at: "2026-08-28T18:30:00+00:00",
};

describe("clientFromRow", () => {
  it("maps the row to the domain client, with the cadence and UTC timestamp", () => {
    expect(clientFromRow(clientRow)).toEqual({
      id: CLIENT,
      trainerId: TRAINER,
      firstName: "Marta",
      lastName: "Ruiz",
      email: "marta@test.local",
      phone: "",
      goal: "Definir",
      level: "",
      initialNotes: "",
      status: "activo",
      startDate: "2026-01-12",
      reviewCadence: { everyDays: 7 },
      macrosVisible: false,
      createdAt: "2026-01-12T09:00:00.500Z",
    });
  });

  it("refuses a status the domain does not know", () => {
    expect(() => clientFromRow({ ...clientRow, status: "pendiente" })).toThrow();
  });
});

describe("clientTrackingFromRow", () => {
  const trackingRow: ClientTrackingDbRow = {
    ...clientRow,
    routine_name: "Fuerza A",
    new_review_week: 4,
    last_review_at: "2026-10-20T10:00:00+00:00",
    current_membership: membershipRow,
  };

  it("maps the page row to the tracking row, with the membership in force", () => {
    const tracking = clientTrackingFromRow(trackingRow);
    expect(tracking.client.id).toBe(CLIENT);
    expect(tracking.routineName).toBe("Fuerza A");
    expect(tracking.newReviewWeek).toBe(4);
    expect(tracking.lastReviewAt).toBe("2026-10-20T10:00:00.000Z");
    expect(tracking.membership?.id).toBe(MEMBERSHIP);
  });

  it("keeps the nulls: no routine, no review, no membership in force", () => {
    const tracking = clientTrackingFromRow({
      ...trackingRow,
      routine_name: null,
      new_review_week: null,
      last_review_at: null,
      current_membership: null,
    });
    expect(tracking).toEqual({
      client: clientFromRow(clientRow),
      routineName: null,
      newReviewWeek: null,
      lastReviewAt: null,
      membership: null,
    });
  });
});

describe("membershipFromRow", () => {
  it("maps the row to the domain membership", () => {
    expect(membershipFromRow(membershipRow)).toEqual({
      id: MEMBERSHIP,
      trainerId: TRAINER,
      clientId: CLIENT,
      type: "trimestral",
      startDate: "2026-09-01",
      endDate: "2026-11-30",
      paymentStatus: "pagada",
      createdAt: "2026-08-28T18:30:00.000Z",
    });
  });

  it("refuses an end date before the start date, as the domain does", () => {
    expect(() => membershipFromRow({ ...membershipRow, end_date: "2026-08-31" })).toThrow();
  });
});

describe("membershipPageFromRow", () => {
  const pageRow: MembershipPageRow = {
    ...membershipRow,
    client_first_name: "Marta",
    client_last_name: "Ruiz",
    client_status: "activo",
    overlapping: true,
  };

  it("splits the page row into the membership, its client and the overlap flag", () => {
    expect(membershipPageFromRow(pageRow)).toEqual({
      membership: membershipFromRow(membershipRow),
      client: { id: CLIENT, firstName: "Marta", lastName: "Ruiz", status: "activo" },
      overlapping: true,
    });
  });
});
