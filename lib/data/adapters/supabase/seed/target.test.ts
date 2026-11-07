import { describe, expect, it } from "vitest";
import { REMOTE_PROJECT_REF, SeedAbort, resolveTarget } from "./target";

/** Un JWT sin firmar con esas claims: la siembra solo mira lo que dice de sí mismo. */
const jwt = (claims: Record<string, unknown>) =>
  ["e30", Buffer.from(JSON.stringify(claims)).toString("base64url"), "firma"].join(".");

const LOCAL_KEY = jwt({ role: "service_role", iss: "supabase-demo" });
const REMOTE_URL = `https://${REMOTE_PROJECT_REF}.supabase.co`;
const SECRET = "sb_secret_abcdefghijklmnopqrstuvwxyz";

const abortOf = (fn: () => unknown): string => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(SeedAbort);
    return (error as Error).message;
  }
  throw new Error("no abortó");
};

describe("siembra de Supabase · contra qué se ejecuta", () => {
  it("defaults to the local instance and needs the service key even for a dry run", () => {
    expect(resolveTarget({ remote: false, env: { SUPABASE_SERVICE_ROLE_KEY: LOCAL_KEY } })).toEqual(
      {
        url: "http://127.0.0.1:54321",
        serviceKey: LOCAL_KEY,
        remote: false,
      },
    );
    expect(abortOf(() => resolveTarget({ remote: false, env: {} }))).toMatch(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it("refuses a remote URL without --remote", () => {
    const env = { SUPABASE_URL: REMOTE_URL, SUPABASE_SERVICE_ROLE_KEY: SECRET };
    expect(abortOf(() => resolveTarget({ remote: false, env }))).toMatch(/--remote/);
  });

  it("with --remote, only the app's project, over https and as a bare origin", () => {
    const ok = resolveTarget({
      remote: true,
      env: { SUPABASE_URL: `${REMOTE_URL}/`, SUPABASE_SERVICE_ROLE_KEY: SECRET },
    });
    expect(ok).toEqual({ url: REMOTE_URL, serviceKey: SECRET, remote: true });

    const refused = [
      undefined,
      "https://otroproyectoxxxxxxxxx.supabase.co",
      `http://${REMOTE_PROJECT_REF}.supabase.co`,
      `${REMOTE_URL}/rest/v1`,
      "http://127.0.0.1:54321",
      `https://${REMOTE_PROJECT_REF}.supabase.co.example.com`,
    ];
    for (const url of refused) {
      abortOf(() =>
        resolveTarget({
          remote: true,
          env: { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: SECRET },
        }),
      );
    }
  });

  it("refuses a key of another project, a key that is not the service one, and a publishable key", () => {
    const remote = (key: string) => () =>
      resolveTarget({
        remote: true,
        env: { SUPABASE_URL: REMOTE_URL, SUPABASE_SERVICE_ROLE_KEY: key },
      });
    expect(abortOf(remote(jwt({ role: "service_role", ref: "otroproyecto" })))).toMatch(
      /otro proyecto/,
    );
    expect(abortOf(remote(jwt({ role: "anon", ref: REMOTE_PROJECT_REF })))).toMatch(/service_role/);
    expect(abortOf(remote("sb_publishable_abc"))).toMatch(/publicable/);
    expect(abortOf(remote("no-es-una-clave"))).toMatch(/forma/);
    expect(
      resolveTarget({
        remote: true,
        env: {
          SUPABASE_URL: REMOTE_URL,
          SUPABASE_SERVICE_ROLE_KEY: jwt({ role: "service_role", ref: REMOTE_PROJECT_REF }),
        },
      }).remote,
    ).toBe(true);
  });
});
