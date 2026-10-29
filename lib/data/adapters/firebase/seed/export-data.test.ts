import { describe, expect, it } from "vitest";
import { COLLECTIONS } from "../helpers";
import {
  EXPORT_COLLECTIONS,
  serializeValue,
  toAuthAccountRecord,
  type AuthUserInput,
} from "./export-data";

const timestamp = { toDate: () => new Date("2026-10-29T10:00:00.000Z") };
const reference = { path: "trainers/t-adrian", withConverter: () => ({}) };

describe("serializeValue", () => {
  it("turns Firestore timestamps and JS dates into ISO strings", () => {
    expect(serializeValue(timestamp)).toBe("2026-10-29T10:00:00.000Z");
    expect(serializeValue(new Date("2026-10-29T10:00:00.000Z"))).toBe("2026-10-29T10:00:00.000Z");
  });

  it("keeps a document reference as its path, not as a live object", () => {
    expect(serializeValue({ trainer: reference })).toEqual({
      trainer: { __ref: "trainers/t-adrian" },
    });
  });

  it("walks nested arrays and objects and leaves plain values alone", () => {
    const input = { name: "Press", sets: [{ reps: 8, rest: null, at: timestamp }], active: true };
    expect(serializeValue(input)).toEqual({
      name: "Press",
      sets: [{ reps: 8, rest: null, at: "2026-10-29T10:00:00.000Z" }],
      active: true,
    });
  });
});

describe("toAuthAccountRecord", () => {
  const user: AuthUserInput = {
    uid: "uid-marta",
    email: "marta@example.com",
    emailVerified: true,
    disabled: false,
    providerData: [{ providerId: "password" }],
    metadata: {
      creationTime: "2026-08-01T09:00:00.000Z",
      lastSignInTime: "2026-10-28T08:00:00.000Z",
    },
    customClaims: { role: "client" },
  };

  it("keeps the fields the migration needs", () => {
    expect(toAuthAccountRecord(user)).toEqual({
      uid: "uid-marta",
      email: "marta@example.com",
      emailVerified: true,
      disabled: false,
      providers: ["password"],
      createdAt: "2026-08-01T09:00:00.000Z",
      lastSignInAt: "2026-10-28T08:00:00.000Z",
      customClaims: { role: "client" },
    });
  });

  it("never copies a password hash or salt, even if the SDK hands them over", () => {
    const leaky = { ...user, passwordHash: "secret-hash", passwordSalt: "secret-salt" };
    const record = toAuthAccountRecord(leaky as AuthUserInput);
    expect(JSON.stringify(record)).not.toContain("secret-hash");
    expect(JSON.stringify(record)).not.toContain("secret-salt");
  });

  it("uses null for a missing email or sign-in date", () => {
    const record = toAuthAccountRecord({
      ...user,
      email: undefined,
      metadata: { creationTime: user.metadata.creationTime },
      customClaims: undefined,
    });
    expect(record).toMatchObject({ email: null, lastSignInAt: null, customClaims: null });
  });
});

describe("EXPORT_COLLECTIONS", () => {
  it("covers every collection the adapter knows, once", () => {
    expect([...EXPORT_COLLECTIONS].sort()).toEqual(Object.values(COLLECTIONS).sort());
  });
});
