import { FirebaseError, getApp } from "firebase/app";
import {
  confirmPasswordReset,
  connectAuthEmulator,
  deleteUser,
  getAuth,
  isSignInWithEmailLink,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signOut,
  updatePassword,
  verifyPasswordResetCode,
  type Auth,
  type User,
} from "firebase/auth";
import { doc, getDoc, writeBatch, type DocumentData } from "firebase/firestore";
import type { InvitationPort, PasswordResetPort, Session, SessionPort } from "@/lib/data/ports";
import { DomainError, clientSchema, emailSchema } from "@/lib/domain";
import type { FirebaseContext } from "./context";

/**
 * Quién es cada cuenta de Firebase Auth. No es una entidad del dominio, es el puente entre un
 * `uid` y la persona que hay detrás: documento `users/{uid}`, que escribe el propio adaptador la
 * primera vez que la cuenta entra. Las reglas de seguridad se apoyan en él.
 */
const USERS = "users";

/** Sesión de nadie: la que devuelve `getSession` sin cuenta abierta, como hacía el mock al salir. */
const SIGNED_OUT: Session = { trainerId: "", clientId: null, role: null };

/** Firebase exige al menos 6 caracteres. Se comprueba antes de gastar el enlace, que es de un solo uso. */
const MIN_PASSWORD_LENGTH = 6;

export interface FirebaseAuthContext extends FirebaseContext {
  auth: Auth;
  /** Página de la app a la que lleva el enlace del correo (`/accept-invite`), con su origen. */
  inviteUrl: string;
  /** Adónde vuelve quien termina de recuperar su contraseña (`/login`), con el origen de la app. */
  loginUrl: string;
}

export function createFirebaseAuthContext(
  ctx: FirebaseContext,
  options: { appName?: string; inviteUrl: string; emulatorUrl?: string },
): FirebaseAuthContext {
  const auth = getAuth(getApp(options.appName));
  // `connectAuthEmulator` solo se puede llamar una vez por instancia: `emulatorConfig` dice si ya se hizo.
  if (options.emulatorUrl && !auth.emulatorConfig) {
    connectAuthEmulator(auth, options.emulatorUrl, { disableWarnings: true });
  }
  return {
    ...ctx,
    auth,
    inviteUrl: options.inviteUrl,
    loginUrl: new URL("/login", options.inviteUrl).href,
  };
}

/**
 * Id del cliente invitado, que viaja en el enlace (`?c=`). No es un dato personal: es un id opaco, y
 * evita buscar al cliente por correo, que las reglas de seguridad no pueden comprobar en una consulta.
 * El enlace del correo lo lleva dentro de `continueUrl`; la dirección que abre el cliente, directa.
 */
function invitedClientId(link: string): string | null {
  try {
    const url = new URL(link);
    const direct = url.searchParams.get("c");
    if (direct) return direct;
    const next = url.searchParams.get("continueUrl");
    return next ? new URL(next).searchParams.get("c") : null;
  } catch {
    return null;
  }
}

const errorCode = (error: unknown): string | null =>
  error instanceof FirebaseError ? error.code : null;

/** Resuelve la persona de una cuenta ya autenticada. Si no hay ninguna, cierra y lo dice. */
async function resolveSession(ctx: FirebaseAuthContext, user: User): Promise<Session> {
  const known = await getDoc(doc(ctx.db, USERS, user.uid));
  if (known.exists()) {
    const data = known.data() as DocumentData;
    return { trainerId: data.trainerId, clientId: data.clientId ?? null, role: data.role };
  }
  // Un entrenador no se enlaza solo: el propietario crea su `users/{uid}` a mano al dar de alta su
  // cuenta, porque un correo sin verificar no demuestra quién es. Sin ese documento no hay persona.
  await signOut(ctx.auth);
  throw new DomainError("session.no_profile", "La cuenta no corresponde a nadie de la cartera");
}

export function createSessionPort(ctx: FirebaseAuthContext): SessionPort {
  return {
    getSession: async () => {
      // La sesión persistida se restaura de forma asíncrona: hay que esperar a que Firebase la lea.
      await ctx.auth.authStateReady();
      return ctx.auth.currentUser ? resolveSession(ctx, ctx.auth.currentUser) : SIGNED_OUT;
    },
    login: async (email, password) => {
      try {
        const { user } = await signInWithEmailAndPassword(ctx.auth, email.trim(), password);
        return await resolveSession(ctx, user);
      } catch (error) {
        const code = errorCode(error);
        if (
          code === "auth/invalid-credential" ||
          code === "auth/invalid-email" ||
          code === "auth/user-not-found" ||
          code === "auth/wrong-password"
        ) {
          throw new DomainError("session.invalid_credentials", "Correo o contraseña incorrectos");
        }
        throw error;
      }
    },
    logout: () => signOut(ctx.auth),
  };
}

export function createInvitationPort(ctx: FirebaseAuthContext): InvitationPort {
  return {
    sendInvitation: async (trainerId, clientId) => {
      const snap = await getDoc(doc(ctx.db, "clients", clientId));
      if (!snap.exists() || snap.data().trainerId !== trainerId) {
        throw new DomainError("not_found", `Cliente ${clientId} no existe`);
      }
      const client = clientSchema.parse({ ...snap.data(), id: snap.id });
      if (client.status !== "invitado") {
        throw new DomainError(
          "invitation.not_invited",
          "El cliente ya no está pendiente de entrar",
        );
      }
      // No se guarda el correo en el navegador: lo abrirá otro, y es el cliente quien lo reescribe.
      await sendSignInLinkToEmail(ctx.auth, client.email, {
        url: `${ctx.inviteUrl}?c=${encodeURIComponent(client.id)}`,
        handleCodeInApp: true,
      });
    },
    isInvitationLink: (link) => isSignInWithEmailLink(ctx.auth, link),
    acceptInvitation: async ({ email, link, password }) => {
      if (!isSignInWithEmailLink(ctx.auth, link)) {
        throw new DomainError("invitation.invalid_link", "El enlace no es de invitación");
      }
      const clientId = invitedClientId(link);
      if (!clientId) {
        throw new DomainError("invitation.invalid_link", "El enlace no dice a qué cliente invita");
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        throw new DomainError("invitation.weak_password", "La contraseña es demasiado corta");
      }
      let user: User;
      try {
        ({ user } = await signInWithEmailLink(ctx.auth, email.trim(), link));
      } catch (error) {
        const code = errorCode(error);
        if (code === "auth/invalid-email") {
          throw new DomainError("invitation.email_mismatch", "El correo no es el invitado");
        }
        if (code === "auth/invalid-action-code" || code === "auth/expired-action-code") {
          throw new DomainError("invitation.invalid_link", "El enlace caducó o ya se usó");
        }
        throw error;
      }
      // Hasta aquí la cuenta existe en Auth, pero solo ahora se puede leer la cartera para saber si
      // alguien invitó de verdad a este correo: cualquiera puede pedir un enlace para cualquier
      // dirección. Si el cliente no existe, ya entró o su correo es otro, la cuenta recién creada
      // se deshace.
      const clientSnap = await getDoc(doc(ctx.db, "clients", clientId)).catch(() => null);
      const parsed = clientSnap?.exists()
        ? clientSchema.safeParse({ ...clientSnap.data(), id: clientSnap.id })
        : null;
      const client = parsed?.success ? parsed.data : null;
      if (
        !client ||
        client.status !== "invitado" ||
        client.email.toLowerCase() !== email.trim().toLowerCase()
      ) {
        await deleteUser(user);
        throw new DomainError("invitation.not_found", "Ningún cliente invitado tiene ese correo");
      }
      await updatePassword(user, password);
      // Un lote: o la cuenta queda enlazada con su cliente y activa, o ninguna de las dos cosas.
      await writeBatch(ctx.db)
        .set(doc(ctx.db, USERS, user.uid), {
          role: "client",
          trainerId: client.trainerId,
          clientId: client.id,
          email: client.email,
        })
        .update(doc(ctx.db, "clients", client.id), { status: "activo" })
        .commit();
      return { trainerId: client.trainerId, clientId: client.id, role: "client" };
    },
  };
}

export function createPasswordResetPort(ctx: FirebaseAuthContext): PasswordResetPort {
  const invalidLink = () =>
    new DomainError("password_reset.invalid_link", "El enlace caducó o ya se usó");
  const weakPassword = () =>
    new DomainError("password_reset.weak_password", "La contraseña es demasiado corta");
  const isDeadCode = (code: string | null) =>
    code === "auth/invalid-action-code" || code === "auth/expired-action-code";
  return {
    sendPasswordReset: async (email) => {
      // Firebase trata un correo mal escrito como una cuenta que no existe y lo traga: se avisa antes.
      if (!emailSchema.safeParse(email).success) {
        throw new DomainError("password_reset.invalid_email", "No es un correo");
      }
      try {
        await sendPasswordResetEmail(ctx.auth, email.trim(), { url: ctx.loginUrl });
      } catch (error) {
        const code = errorCode(error);
        if (code === "auth/invalid-email") {
          throw new DomainError("password_reset.invalid_email", "No es un correo");
        }
        // Sin cuenta con ese correo: se trata como enviado, para no decir quién usa la app.
        if (code === "auth/user-not-found") return;
        throw error;
      }
    },
    checkPasswordResetCode: async (code) => {
      try {
        return { email: await verifyPasswordResetCode(ctx.auth, code) };
      } catch (error) {
        if (isDeadCode(errorCode(error))) throw invalidLink();
        throw error;
      }
    },
    confirmPasswordReset: async ({ code, password }) => {
      // Antes de gastar el código, que es de un solo uso.
      if (password.length < MIN_PASSWORD_LENGTH) throw weakPassword();
      try {
        await confirmPasswordReset(ctx.auth, code, password);
      } catch (error) {
        const failure = errorCode(error);
        if (isDeadCode(failure)) throw invalidLink();
        if (failure === "auth/weak-password") throw weakPassword();
        throw error;
      }
    },
  };
}
