import { describe, expect, it } from "vitest";
import { trainerFromRow } from "./trainer";

describe("trainerFromRow", () => {
  it("maps a row to the domain trainer and normalises the timestamp to UTC", () => {
    expect(
      trainerFromRow({
        id: "11111111-1111-1111-1111-111111111111",
        name: "Entrenador A",
        email: "trainer-a@test.local",
        time_zone: "Europe/Madrid",
        created_at: "2026-01-05T10:00:00.123456+00:00",
      }),
    ).toEqual({
      id: "11111111-1111-1111-1111-111111111111",
      name: "Entrenador A",
      email: "trainer-a@test.local",
      timeZone: "Europe/Madrid",
      createdAt: "2026-01-05T10:00:00.123Z",
    });
  });
});
