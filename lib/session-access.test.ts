import { describe, expect, it } from "vitest";
import type { Session } from "@/lib/data/ports";
import { canEnter, homePath } from "./session-access";

const trainer: Session = { trainerId: "t", clientId: null, role: "trainer" };
const client: Session = { trainerId: "t", clientId: "c", role: "client" };
const demo: Session = { trainerId: "t", clientId: "c", role: "trainer" };
const signedOut: Session = { trainerId: "", clientId: null, role: null };

describe("session access", () => {
  it("a trainer gets the panel and not the client area", () => {
    expect(canEnter("trainer", trainer)).toBe(true);
    expect(canEnter("client", trainer)).toBe(false);
    expect(homePath(trainer)).toBe("/dashboard");
  });

  it("a client gets the client area and never the panel", () => {
    expect(canEnter("client", client)).toBe(true);
    expect(canEnter("trainer", client)).toBe(false);
    expect(homePath(client)).toBe("/routine");
  });

  it("the demo session (trainer with a client at hand) can walk both areas", () => {
    expect(canEnter("trainer", demo)).toBe(true);
    expect(canEnter("client", demo)).toBe(true);
    expect(homePath(demo)).toBe("/dashboard");
  });

  it("nobody signed in enters either area and goes to login", () => {
    expect(canEnter("trainer", signedOut)).toBe(false);
    expect(canEnter("client", signedOut)).toBe(false);
    expect(homePath(signedOut)).toBe("/login");
  });
});
