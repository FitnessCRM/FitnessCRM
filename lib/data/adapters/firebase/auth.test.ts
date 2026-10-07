import { doc, getDoc, setDoc, type Firestore } from "firebase/firestore";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client, Trainer } from "@/lib/domain";
import {
  createFirebaseAuthContext,
  createInvitationPort,
  createPasswordResetPort,
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

/** El código del último enlace de recuperación que el emulador "envió" a ese correo, si lo hay. */
async function lastResetCodeFor(email: string): Promise<string | null> {
  const res = await fetch(`http://${authHost}/emulator/v1/projects/${PROJECT}/oobCodes`);
  const { oobCodes } = (await res.json()) as {
    oobCodes: { email: string; requestType: string; oobLink: string }[];
  };
  const last = oobCodes
    .filter((c) => c.email === email && c.requestType === "PASSWORD_RESET")
    .at(-1);
  return last ? new URL(last.oobLink).searchParams.get("oobCode") : null;
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
    expect(session).toEqual({ trainerId: TRAINER.id, clientId, role: "client" });
    expect((await getDoc(doc(db, "clients", clientId))).data()?.status).toBe("activo");

    // Después, entra con correo y contraseña, como cualquiera.
    const sessions = createSessionPort(ctx);
    await sessions.logout();
    expect(await sessions.getSession()).toEqual({ trainerId: "", clientId: null, role: null });
    expect(await sessions.login(email, "secreto-1")).toEqual({
      trainerId: TRAINER.id,
      clientId,
      role: "client",
    });
    expect(await sessions.getSession()).toEqual({
      trainerId: TRAINER.id,
      clientId,
      role: "client",
    });
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
    // El enlace apunta al cliente invitado de otro correo: el correo no coincide, no hay cuenta.
    await sendSignInLinkToEmail(ctx.auth, stranger, {
      url: `${INVITE_URL}?c=${clientId}`,
      handleCodeInApp: true,
    });
    const link = await lastLinkFor(stranger);
    await expect(
      invitations.acceptInvitation({ email: stranger, link, password: "secreto-1" }),
    ).rejects.toMatchObject({ code: "invitation.not_found" });
    expect((await getDoc(doc(db, "clients", clientId))).data()?.status).toBe("invitado");
    expect(ctx.auth.currentUser).toBeNull();
    await expect(createSessionPort(ctx).login(stranger, "secreto-1")).rejects.toMatchObject({
      code: "session.invalid_credentials",
    });
  });

  it("a link that does not say which client it invites is not spent", async () => {
    const invitations = createInvitationPort(ctx);
    const { sendSignInLinkToEmail } = await import("firebase/auth");
    await sendSignInLinkToEmail(ctx.auth, email, { url: INVITE_URL, handleCodeInApp: true });
    const link = await lastLinkFor(email);
    await expect(
      invitations.acceptInvitation({ email, link, password: "secreto-1" }),
    ).rejects.toMatchObject({ code: "invitation.invalid_link" });
    expect(ctx.auth.currentUser).toBeNull();
  });

  it("a trainer logs in through the users/{uid} document the owner created for the account", async () => {
    const sessions = createSessionPort(ctx);
    const { createUserWithEmailAndPassword } = await import("firebase/auth");
    const { user } = await createUserWithEmailAndPassword(ctx.auth, TRAINER.email, "entrenador-1");
    await setDoc(doc(db, "users", user.uid), {
      role: "trainer",
      trainerId: TRAINER.id,
      clientId: null,
      email: TRAINER.email,
    });
    await ctx.auth.signOut();
    expect(await sessions.login(TRAINER.email, "entrenador-1")).toEqual({
      trainerId: TRAINER.id,
      clientId: null,
      role: "trainer",
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

  it("recover a password: ask for the link, open it and set a new one", async () => {
    const { createUserWithEmailAndPassword, signInWithEmailAndPassword } =
      await import("firebase/auth");
    const account = `recupera${n}-${Date.now()}@hector.test`;
    await createUserWithEmailAndPassword(ctx.auth, account, "vieja-123");
    await ctx.auth.signOut();

    const reset = createPasswordResetPort(ctx);
    await reset.sendPasswordReset(account);
    const code = await lastResetCodeFor(account);
    expect(code).toBeTruthy();
    expect(await reset.checkPasswordResetCode(code as string)).toEqual({ email: account });

    await reset.confirmPasswordReset({ code: code as string, password: "nueva-456" });
    // No abre sesión: se vuelve a entrar con la nueva, y la vieja ya no vale.
    expect(ctx.auth.currentUser).toBeNull();
    await expect(signInWithEmailAndPassword(ctx.auth, account, "vieja-123")).rejects.toBeTruthy();
    await expect(signInWithEmailAndPassword(ctx.auth, account, "nueva-456")).resolves.toBeTruthy();
  });

  it("asking for the link of an unknown email resolves like any other and sends nothing", async () => {
    const reset = createPasswordResetPort(ctx);
    const stranger = `nadie${n}-${Date.now()}@hector.test`;
    await expect(reset.sendPasswordReset(stranger)).resolves.toBeUndefined();
    expect(await lastResetCodeFor(stranger)).toBeNull();
    await expect(reset.sendPasswordReset("no es un correo")).rejects.toMatchObject({
      code: "password_reset.invalid_email",
    });
  });

  it("a recovery code is used once, a weak password does not spend it and a made-up one is invalid", async () => {
    const { createUserWithEmailAndPassword } = await import("firebase/auth");
    const account = `recupera-una-vez${n}-${Date.now()}@hector.test`;
    await createUserWithEmailAndPassword(ctx.auth, account, "vieja-123");
    await ctx.auth.signOut();

    const reset = createPasswordResetPort(ctx);
    await reset.sendPasswordReset(account);
    const code = (await lastResetCodeFor(account)) as string;

    await expect(reset.confirmPasswordReset({ code, password: "corta" })).rejects.toMatchObject({
      code: "password_reset.weak_password",
    });
    // La contraseña corta se rechazó antes de gastar el código.
    await expect(reset.checkPasswordResetCode(code)).resolves.toEqual({ email: account });

    await reset.confirmPasswordReset({ code, password: "nueva-456" });
    await expect(reset.checkPasswordResetCode(code)).rejects.toMatchObject({
      code: "password_reset.invalid_link",
    });
    await expect(reset.confirmPasswordReset({ code, password: "otra-789" })).rejects.toMatchObject({
      code: "password_reset.invalid_link",
    });
    await expect(reset.checkPasswordResetCode("inventado")).rejects.toMatchObject({
      code: "password_reset.invalid_link",
    });
  });
});
