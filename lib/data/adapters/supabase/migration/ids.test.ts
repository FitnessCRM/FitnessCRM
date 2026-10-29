import { describe, expect, it } from "vitest";
import { accountIdFor, clientIdFor, supabaseIdFor } from "./ids";
import { remapPeople } from "./remap";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("supabaseIdFor", () => {
  it("returns a uuid v5 and the same one for the same source", () => {
    const first = supabaseIdFor("firebase-uid-abc");
    expect(first).toMatch(UUID);
    expect(supabaseIdFor("firebase-uid-abc")).toBe(first);
    expect(supabaseIdFor("firebase-uid-xyz")).not.toBe(first);
  });

  it("keeps a client document apart from an account with the same raw id", () => {
    expect(clientIdFor("same")).not.toBe(accountIdFor("same"));
  });
});

describe("remapPeople", () => {
  it("rewrites trainer, client and account ids, and the client's trainerId to the trainer's uuid", () => {
    const out = remapPeople({
      trainers: [{ id: "uid-t", data: { id: "uid-t", name: "T", email: "t@x.es" } }],
      clients: [
        {
          id: "doc-c",
          data: { id: "doc-c", trainerId: "uid-t", firstName: "C" },
        },
      ],
      accounts: [{ uid: "uid-t", email: "t@x.es" }],
    });

    const trainerId = accountIdFor("uid-t");
    const [trainer] = out.trainers;
    const [client] = out.clients;
    const [account] = out.accounts;
    expect(trainer?.id).toBe(trainerId);
    expect(trainer?.data).toMatchObject({ id: trainerId });
    expect(client?.id).toBe(clientIdFor("doc-c"));
    expect(client?.data).toMatchObject({
      id: clientIdFor("doc-c"),
      trainerId,
    });
    expect(account?.uid).toBe(trainerId);
  });
});
