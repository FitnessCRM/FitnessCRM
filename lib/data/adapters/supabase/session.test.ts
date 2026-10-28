import { describe, expect, it } from "vitest";
import { DomainError } from "@/lib/domain";
import { claimsOf, sessionFromClaims } from "./session";

const TRAINER = "11111111-1111-1111-1111-111111111111";
const CLIENT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("sessionFromClaims", () => {
  it("opens a trainer session without a client", () => {
    expect(sessionFromClaims({ user_role: "trainer", trainer_id: TRAINER })).toEqual({
      trainerId: TRAINER,
      clientId: null,
      role: "trainer",
    });
  });

  it("opens a client session with its trainer and its client", () => {
    expect(
      sessionFromClaims({ user_role: "client", trainer_id: TRAINER, client_id: CLIENT }),
    ).toEqual({ trainerId: TRAINER, clientId: CLIENT, role: "client" });
  });

  it("refuses a client without its client claim", () => {
    expect(() => sessionFromClaims({ user_role: "client", trainer_id: TRAINER })).toThrow(
      DomainError,
    );
  });

  it("refuses an account with no role: the platform admin or an unfinished signup", () => {
    expect(() => sessionFromClaims({ user_role: "admin" })).toThrow(DomainError);
    try {
      sessionFromClaims({});
    } catch (error) {
      expect((error as DomainError).code).toBe("session.no_profile");
    }
  });
});

describe("claimsOf", () => {
  it("reads the payload of a base64url JWT", () => {
    const payload = Buffer.from(
      JSON.stringify({ user_role: "trainer", trainer_id: TRAINER }),
    ).toString("base64url");
    const token = `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`;
    expect(claimsOf(token)).toEqual({ user_role: "trainer", trainer_id: TRAINER });
  });
});
