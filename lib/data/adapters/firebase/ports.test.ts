import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { getApp } from "firebase/app";
import { doc, getFirestore, setDoc } from "firebase/firestore";
import { beforeAll, describe, expect, it } from "vitest";
import { createDemoState, createMockPorts } from "../mock";
import { TRAINER_ID } from "../mock/demo-data/common";
import { COLLECTIONS } from "./helpers";
import { createFirebasePorts } from "./ports";

/**
 * Contra los emuladores de Firestore y de Auth (`pnpm test:firebase`). Comprueba la composición: que
 * hay un puerto por cada uno que tiene el adaptador en memoria (la app no se entera de cuál hay) y
 * que una cuenta de entrenador real entra y lee su cartera a través de ellos.
 */
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const APP = "firebase-ports-test";

describe.skipIf(!firestoreHost || !authHost)("adaptador de Firebase · composición", () => {
  let ports: ReturnType<typeof createFirebasePorts>;

  beforeAll(() => {
    ports = createFirebasePorts({
      config: { projectId: "demo-hector", apiKey: "demo-api-key" },
      inviteUrl: "http://localhost:3000/accept-invite",
      emulatorHost: (firestoreHost as string).split(":")[0],
      appName: APP,
    });
  });

  it("has a port for every one the in-memory adapter has", () => {
    const { state: _state, ...reference } = createMockPorts();
    void _state;
    expect(Object.keys(ports).sort()).toEqual(Object.keys(reference).sort());
    expect(Object.keys(ports)).toHaveLength(18);
  });

  it("a trainer account logs in and reads its own portfolio through the ports", async () => {
    await fetch(
      `http://${firestoreHost}/emulator/v1/projects/demo-hector/databases/(default)/documents`,
      { method: "DELETE" },
    );
    const state = createDemoState("2026-10-03");
    const db = getFirestore(getApp(APP));
    await Promise.all([
      ...state.trainers.map((t) => setDoc(doc(db, COLLECTIONS.trainers, t.id), t)),
      ...state.clients.map((c) => setDoc(doc(db, COLLECTIONS.clients, c.id), c)),
    ]);
    const email = `composicion-${Date.now()}@hector.test`;
    const { user } = await createUserWithEmailAndPassword(getAuth(getApp(APP)), email, "secreto-1");
    await setDoc(doc(db, "users", user.uid), {
      role: "trainer",
      trainerId: TRAINER_ID,
      clientId: null,
      email,
    });
    await ports.session.logout();

    const session = await ports.session.login(email, "secreto-1");
    expect(session).toEqual({ trainerId: TRAINER_ID, clientId: null, role: "trainer" });
    expect(await ports.session.getSession()).toEqual(session);
    expect((await ports.trainer.getTrainer(TRAINER_ID))?.id).toBe(TRAINER_ID);
    expect((await ports.clients.listClients(TRAINER_ID)).length).toBe(state.clients.length);
    await ports.session.logout();
    expect(await ports.session.getSession()).toMatchObject({ role: null, trainerId: "" });
  });
});
