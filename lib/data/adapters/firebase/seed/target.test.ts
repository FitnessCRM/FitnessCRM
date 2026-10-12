import path from "node:path";
import { describe, expect, it } from "vitest";
import { REAL_PROJECT_ID, SeedAbort, assertServiceAccountKey, resolveTarget } from "./target";

const repoRoot = path.resolve("repo");
const outside = path.resolve("secrets", "clave.json");
const emulators = {
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
};

describe("siembra · contra qué se ejecuta", () => {
  it("the real project needs its exact id and a key outside the repo", () => {
    expect(resolveTarget({ project: REAL_PROJECT_ID, key: outside, env: {}, repoRoot })).toEqual({
      mode: "real",
      projectId: REAL_PROJECT_ID,
      keyPath: outside,
    });
    // La clave también puede venir del entorno.
    expect(
      resolveTarget({
        project: REAL_PROJECT_ID,
        env: { GOOGLE_APPLICATION_CREDENTIALS: outside },
        repoRoot,
      }).mode,
    ).toBe("real");
  });

  it.each([
    ["no project", { key: outside, env: {} }],
    ["another real project", { project: "otro-proyecto", key: outside, env: {} }],
    ["a demo project without emulators", { project: "demo-hector", key: outside, env: {} }],
    ["no key", { project: REAL_PROJECT_ID, env: {} }],
    [
      "a key inside the repo",
      { project: REAL_PROJECT_ID, key: path.join(repoRoot, "k.json"), env: {} },
    ],
    [
      "a key inside the repo, through the environment",
      {
        project: REAL_PROJECT_ID,
        env: { GOOGLE_APPLICATION_CREDENTIALS: path.join(repoRoot, "secrets", "k.json") },
      },
    ],
  ])("refuses %s", (_case, input) => {
    expect(() => resolveTarget({ ...input, repoRoot })).toThrow(SeedAbort);
  });

  it("emulators need both variables, a demo project and no key", () => {
    expect(resolveTarget({ project: "demo-hector", env: emulators, repoRoot })).toEqual({
      mode: "emulator",
      projectId: "demo-hector",
    });
    // Una clave en el entorno no convierte la ejecución en real, ni se carga.
    expect(
      resolveTarget({
        project: "demo-hector",
        env: { ...emulators, GOOGLE_APPLICATION_CREDENTIALS: outside },
        repoRoot,
      }).mode,
    ).toBe("emulator");
  });

  it.each([
    ["only the Firestore emulator", { FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" }, "demo-hector"],
    ["only the Auth emulator", { FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099" }, "demo-hector"],
    [
      "only one emulator and the real project",
      { FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" },
      REAL_PROJECT_ID,
    ],
    ["emulators with the real project", emulators, REAL_PROJECT_ID],
    [
      "an emulator on another machine",
      { ...emulators, FIRESTORE_EMULATOR_HOST: "10.0.0.5:8080" },
      "demo-hector",
    ],
  ])("refuses %s", (_case, env, project) => {
    expect(() => resolveTarget({ project, env, repoRoot })).toThrow(SeedAbort);
  });

  it("refuses a key passed along with the emulators", () => {
    expect(() =>
      resolveTarget({ project: "demo-hector", key: outside, env: emulators, repoRoot }),
    ).toThrow(SeedAbort);
  });

  it("the key has to be a service account of the allowed project", () => {
    const key = {
      type: "service_account",
      project_id: REAL_PROJECT_ID,
      client_email: "seed@example.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----",
    };
    expect(assertServiceAccountKey(key)).toEqual({
      projectId: REAL_PROJECT_ID,
      clientEmail: key.client_email,
      privateKey: key.private_key,
    });
    expect(() => assertServiceAccountKey({ ...key, project_id: "otro-proyecto" })).toThrow(
      SeedAbort,
    );
    expect(() => assertServiceAccountKey({ ...key, type: "authorized_user" })).toThrow(SeedAbort);
    expect(() => assertServiceAccountKey({ ...key, private_key: undefined })).toThrow(SeedAbort);
    expect(() => assertServiceAccountKey(null)).toThrow(SeedAbort);
    // El mensaje no arrastra nada de la clave.
    try {
      assertServiceAccountKey({ ...key, project_id: "otro-proyecto" });
    } catch (error) {
      expect(String(error)).not.toContain(key.private_key);
      expect(String(error)).not.toContain(key.client_email);
    }
  });
});
