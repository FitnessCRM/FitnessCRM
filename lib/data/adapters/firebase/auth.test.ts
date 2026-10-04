import { doc, getDoc, setDoc, type Firestore } from "firebase/firestore";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client, Trainer } from "@/lib/domain";
import {
  createFirebaseAuthContext,
  createInvitationPort,
  createSessionPort,
  type FirebaseAuthContext,
} from "./auth";
import { createFirestore } from "./config";
import { createFirebaseContext } from "./context";

/**
 * Contra los emuladores de Firestore y de Auth: `pnpm test:firebase` los arranca. Sin ellos el
 * archivo se salta. El emulador de Auth no envía correos: deja los enlaces en una API propia.
 */
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const PROJECT = "demo-hector";
const APP_NAME = "firebase-auth-test";
const INVITE_URL = "http://localhost:3000/accept-invite";

const TRAINER: Trainer = {
  id: "t-auth",
  name: "Entrenador",
  email: "entrenador@hector.test",
  timeZone: "Europe/Madrid",
  createdAt: "2026-01-01T08:00:00.000Z",
};

const invited = (id: string, email: string): Client => ({
  id,
  trainerId: TRAINER.id,
  firstName: "Marta",
  lastName: "Gil",
  email,
  phone: "",
  goal: "",
  level: "",
  initialNotes: "",
  status: "invitado",
  startDate: "2026-09-01",
  reviewCadence: { everyDays: 7 },
  createdAt: "2026-09-01T08:00:00.000Z",
});

/** El último enlace de acceso que el emulador "envió" a ese correo. */
async function lastLinkFor(email: string): Promise<string> {
  const res = await fetch(`http://${authHost}/emulator/v1/projects/${PROJECT}/oobCodes`);
  const { oobCodes } = (await res.json()) as {
    oobCodes: { email: string; requestType: string; oobLink: string }[];
  };
  const mine = oobCodes.filter((c) => c.email === email && c.requestType === "EMAIL_SIGNIN");
  const last = mine.at(-1);
  if (!last) throw new Error(`El emulador no tiene ningún enlace para ${email}`);
  return last.oobLink;
}

describe.skipIf(!firestoreHost || !authHost)("adaptador de Firebase · auth", () => {
  let db: Firestore;
  let ctx: FirebaseAuthContext;
  let n = 0;

  beforeAll(() => {
    const [host = "127.0.0.1", port = "8080"] = (firestoreHost as string).split(":");
    db = createFirestore(
      { projectId: PROJECT, apiKey: "demo-api-key" },
      { appName: APP_NAME, emulator: { host, port: Number(port) } },
    );
    ctx = createFirebaseAuthContext(createFirebaseContext(db), {
      appName: APP_NAME,
      inviteUrl: INVITE_URL,
      emulatorUrl: `http://${authHost}`,
    });
  });

  // Un correo distinto por test: el emulador de Auth conserva las cuentas entre tests.
  let email: string;
  let clientId: string;
  beforeEach(async () => {
    n += 1;
    email = `marta${n}-${Date.now()}@hector.test`;
    clientId = `c-auth-${n}`;
    await setDoc(doc(db, "trainers", TRAINER.id), TRAINER);
    await setDoc(doc(db, "clients", clientId), invited(clientId, email));
    await ctx.auth.signOut();
  });

  it("send, accept: the client sets a password, becomes active and gets a session", async () => {
    const invitations = createInvitationPort(ctx);
    await invitations.sendInvitation(TRAINER.id, clientId);
    const link = await lastLinkFor(email);
    expect(invitations.isInvitationLink(link)).toBe(true);
    expect(invitations.isInvitationLink("http://localhost:3000/login")).toBe(false);

    const session = await invitations.acceptInvitation({ email, link, password: "secreto-1" });
    expect(session).toEqual({ trainerId: TRAINER.id, clientId });
    expect((await getDoc(doc(db, "clients", clientId))).data()?.status).toBe("activo");

    // Después, entra con correo y contraseña, como cualquiera.
    const sessions = createSessionPort(ctx);
    await sessions.logout();
    expect(await sessions.getSession()).toEqual({ trainerId: "", clientId: null });
    expect(await sessions.login(email, "secreto-1")).toEqual({ trainerId: TRAINER.id, clientId });
    expect(await sessions.getSession()).toEqual({ trainerId: TRAINER.id, clientId });
  });

  it("only sends to an own client that is still invited", async () => {
    const invitations = createInvitationPort(ctx);
    await expect(invitations.sendInvitation("t-otra", clientId)).rejects.toMatchObject({
      code: "not_found",
    });
    await setDoc(doc(db, "clients", clientId), { ...invited(clientId, email), status: "activo" });
    await expect(invitations.sendInvitation(TRAINER.id, clientId)).rejects.toMatchObject({
      code: "invitation.not_invited",
    });
  });

  it("rejects a link opened with another email, and a weak password before spending the link", async () => {
    const invitations = createInvitationPort(ctx);
    await invitations.sendInvitation(TRAINER.id, clientId);
    const link = await lastLinkFor(email);
    await expect(
      invitations.acceptInvitation({ email, link, password: "123" }),
    ).rejects.toMatchObject({ code: "invitation.weak_password" });
    await expect(
      invitations.acceptInvitation({ email: "otra@hector.test", link, password: "secreto-1" }),
    ).rejects.toMatchObject({ code: "invitation.email_mismatch" });
    // El enlace sigue valiendo: ninguno de los dos fallos lo gastó.
    const session = await invitations.acceptInvitation({ email, link, password: "secreto-1" });
    expect(session.clientId).toBe(clientId);
  });

  it("a link can only be used once", async () => {
    const invitations = createInvitationPort(ctx);
    await invitations.sendInvitation(TRAINER.id, clientId);
    const link = await lastLinkFor(email);
    await invitations.acceptInvitation({ email, link, password: "secreto-1" });
    await ctx.auth.signOut();
    await expect(
      invitations.acceptInvitation({ email, link, password: "secreto-2" }),
    ).rejects.toMatchObject({ code: "invitation.invalid_link" });
  });

  it("an email nobody invited gets no account out of a link", async () => {
    const stranger = `intruso${n}-${Date.now()}@hector.test`;
    const invitations = createInvitationPort(ctx);
    // Cualquiera puede pedir un enlace para cualquier correo: se pide directamente a Auth.
    const { sendSignInLinkToEmail } = await import("firebase/auth");
    await sendSignInLinkToEmail(ctx.auth, stranger, { url: INVITE_URL, handleCodeInApp: true });
    const link = await lastLinkFor(stranger);
    await expect(
      invitations.acceptInvitation({ email: stranger, link, password: "secreto-1" }),
    ).rejects.toMatchObject({ code: "invitation.not_found" });
    expect(ctx.auth.currentUser).toBeNull();
    await expect(createSessionPort(ctx).login(stranger, "secreto-1")).rejects.toMatchObject({
      code: "session.invalid_credentials",
    });
  });

  it("a trainer account is recognised by the email of its profile on first login", async () => {
    const sessions = createSessionPort(ctx);
    const { createUserWithEmailAndPassword } = await import("firebase/auth");
    await createUserWithEmailAndPassword(ctx.auth, TRAINER.email, "entrenador-1");
    await ctx.auth.signOut();
    expect(await sessions.login(TRAINER.email, "entrenador-1")).toEqual({
      trainerId: TRAINER.id,
      clientId: null,
    });
  });

  it("login with a wrong password is a domain error, and an account with no profile is signed out", async () => {
    const sessions = createSessionPort(ctx);
    await expect(sessions.login(TRAINER.email, "mal")).rejects.toMatchObject({
      code: "session.invalid_credentials",
    });
    const { createUserWithEmailAndPassword } = await import("firebase/auth");
    const orphan = `huerfano${n}-${Date.now()}@hector.test`;
    await createUserWithEmailAndPassword(ctx.auth, orphan, "secreto-1");
    await ctx.auth.signOut();
    await expect(sessions.login(orphan, "secreto-1")).rejects.toMatchObject({
      code: "session.no_profile",
    });
    expect(ctx.auth.currentUser).toBeNull();
  });
});
