import { describe, expect, it } from "vitest";
import { assertLocalUrl, DEV_PASSWORDS, loadPeople } from "./load-people";
import type { PeoplePlan } from "./people";

const URL_LOCAL = "http://127.0.0.1:54321";
const TRAINER = "11111111-1111-4111-8111-111111111111";
const CLIENT_ACCOUNT = "22222222-2222-4222-8222-222222222222";
const CLIENT = "33333333-3333-4333-8333-333333333333";

const plan: PeoplePlan = {
  trainers: [
    {
      id: TRAINER,
      name: "Entrenador",
      email: "trainer@example.com",
      time_zone: "Europe/Madrid",
      created_at: "2026-08-01T09:00:00.000Z",
    },
  ],
  clients: [
    {
      id: CLIENT,
      trainer_id: TRAINER,
      first_name: "Cliente",
      last_name: "Prueba",
      email: "client@example.com",
      phone: "",
      goal: "",
      level: "",
      initial_notes: "",
      status: "activo",
      start_date: "2026-08-03",
      review_every_days: 7,
      macros_visible: true,
      created_at: "2026-08-03T09:00:00.000Z",
    },
  ],
  profiles: [
    { user_id: TRAINER, role: "trainer", trainer_id: TRAINER, client_id: null },
    { user_id: CLIENT_ACCOUNT, role: "client", trainer_id: TRAINER, client_id: CLIENT },
  ],
  unlinkedAccountUids: [],
  clientsWithoutAccount: [],
};

const accounts = [
  { uid: TRAINER, email: "trainer@example.com" },
  { uid: CLIENT_ACCOUNT, email: "client@example.com" },
];

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

/** Un `fetch` falso: el de Auth responde 404 (cuenta nueva) salvo que el uid esté en `existing`. */
function fakeFetch(existing: string[] = []) {
  const calls: Call[] = [];
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ url, method, headers, body });
    if (method === "GET" && url.includes("/auth/v1/admin/users/")) {
      const uid = url.split("/").pop() ?? "";
      return new Response("{}", { status: existing.includes(uid) ? 200 : 404 });
    }
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  return { calls, fetchFn };
}

describe("loadPeople", () => {
  it("creates each new linked auth user with its id and email and no password, before the rows", async () => {
    const { calls, fetchFn } = fakeFetch();
    const report = await loadPeople(plan, accounts, {
      url: URL_LOCAL,
      serviceKey: "service",
      fetch: fetchFn,
    });

    const creates = calls.filter(
      (c) => c.method === "POST" && c.url.endsWith("/auth/v1/admin/users"),
    );
    expect(creates.map((c) => c.body)).toEqual([
      {
        id: TRAINER,
        email: "trainer@example.com",
        email_confirm: true,
        user_metadata: {},
        app_metadata: {},
      },
      {
        id: CLIENT_ACCOUNT,
        email: "client@example.com",
        email_confirm: true,
        user_metadata: {},
        app_metadata: {},
      },
    ]);
    expect(creates.every((c) => !("password" in (c.body as object)))).toBe(true);

    const order = calls.map((c) => c.url.replace(URL_LOCAL, ""));
    const lastAuth = Math.max(...order.map((u, i) => (u.includes("/auth/") ? i : -1)));
    const firstTrainers = order.findIndex((u) => u.startsWith("/rest/v1/trainers"));
    const firstProfiles = order.findIndex((u) => u.startsWith("/rest/v1/profiles"));
    expect(lastAuth).toBeLessThan(firstTrainers);
    expect(firstTrainers).toBeLessThan(order.findIndex((u) => u.startsWith("/rest/v1/clients")));
    expect(order.findIndex((u) => u.startsWith("/rest/v1/clients"))).toBeLessThan(firstProfiles);

    expect(report).toEqual({
      authUsersCreated: 2,
      authUsersSkipped: 0,
      passwordsSet: 0,
      trainers: 1,
      clients: 1,
      profiles: 2,
    });
  });

  it("sets the dev password of accounts that already exist, and creates none of them", async () => {
    const { calls, fetchFn } = fakeFetch([TRAINER, CLIENT_ACCOUNT]);
    const report = await loadPeople(plan, accounts, {
      url: URL_LOCAL,
      serviceKey: "service",
      fetch: fetchFn,
    });
    expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/auth/v1/admin/users"))).toBe(
      false,
    );
    const puts = calls.filter((c) => c.method === "PUT");
    expect(puts.map((c) => [c.url.replace(URL_LOCAL, ""), c.body])).toEqual([
      [`/auth/v1/admin/users/${TRAINER}`, { password: DEV_PASSWORDS.trainer }],
      [`/auth/v1/admin/users/${CLIENT_ACCOUNT}`, { password: DEV_PASSWORDS.client }],
    ]);
    expect(report).toMatchObject({ authUsersSkipped: 2, passwordsSet: 2 });
  });

  it("uses the fixed dev passwords, the trainer's admin123 and the client's cliente123", () => {
    expect(DEV_PASSWORDS).toEqual({ trainer: "admin123", client: "cliente123" });
  });

  it("upserts on the primary key with merge-duplicates and the service key", async () => {
    const { calls, fetchFn } = fakeFetch();
    await loadPeople(plan, accounts, { url: URL_LOCAL, serviceKey: "service", fetch: fetchFn });
    const rest = calls.filter((c) => c.url.includes("/rest/v1/"));
    expect(rest.map((c) => c.url.replace(URL_LOCAL, ""))).toEqual([
      "/rest/v1/trainers?on_conflict=id",
      "/rest/v1/clients?on_conflict=id",
      "/rest/v1/profiles?on_conflict=user_id",
    ]);
    for (const call of rest) {
      expect(call.headers.Prefer).toBe("resolution=merge-duplicates,return=minimal");
      expect(call.headers.apikey).toBe("service");
    }
  });

  it("refuses any URL that is not the local instance, before sending a request", async () => {
    const { calls, fetchFn } = fakeFetch();
    await expect(
      loadPeople(plan, accounts, {
        url: "https://abcd.supabase.co",
        serviceKey: "service",
        fetch: fetchFn,
      }),
    ).rejects.toThrow(/solo corre contra la instancia local/);
    expect(calls).toHaveLength(0);
  });
});

describe("assertLocalUrl", () => {
  it("accepts localhost and 127.0.0.1, and refuses anything else", () => {
    expect(() => assertLocalUrl("http://127.0.0.1:54321")).not.toThrow();
    expect(() => assertLocalUrl("http://localhost:54321")).not.toThrow();
    expect(() => assertLocalUrl("https://fitnesscrm.supabase.co")).toThrow();
    expect(() => assertLocalUrl("no es una url")).toThrow(/no es válida/);
  });
});
