import { FirebaseError, getApp } from "firebase/app";
import {
  connectAuthEmulator,
  deleteUser,
  getAuth,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signOut,
  updatePassword,
  type Auth,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import type { InvitationPort, Session, SessionPort } from "@/lib/data/ports";
import { DomainError, clientSchema, trainerSchema } from "@/lib/domain";
import type { FirebaseContext } from "./context";

/**
 * Quién es cada cuenta de Firebase Auth. No es una entidad del dominio, es el puente entre un
 * `uid` y la persona que hay detrás: documento `users/{uid}`, que escribe el propio adaptador la
 * primera vez que la cuenta entra. Las reglas de seguridad se apoyan en él.
 */
const USERS = "users";

/** Sesión de nadie: la que devuelve `getSession` sin cuenta abierta, como hacía el mock al salir. */
const SIGNED_OUT: Session = { trainerId: "", clientId: null };

/** Firebase exige al menos 6 caracteres. Se comprueba antes de gastar el enlace, que es de un solo uso. */
const MIN_PASSWORD_LENGTH = 6;

export interface FirebaseAuthContext extends FirebaseContext {
  auth: Auth;
  /** Página de la app a la que lleva el enlace del correo (`/accept-invite`), con su origen. */
  inviteUrl: string;
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
  return { ...ctx, auth, inviteUrl: options.inviteUrl };
}

/**
 * Firestore compara correos tal cual y Firebase Auth los guarda en minúsculas. Mientras el dominio no
 * normalice el correo al guardarlo, se prueba también la forma en minúsculas del que escribe quien
 * entra; un correo guardado con mayúsculas no se encuentra si se escribe en minúsculas.
 */
const emailVariants = (email: string) => [...new Set([email.trim(), email.trim().toLowerCase()])];

const errorCode = (error: unknown): string | null =>
  error instanceof FirebaseError ? error.code : null;

/** Resuelve la persona de una cuenta ya autenticada. Si no hay ninguna, cierra y lo dice. */
async function resolveSession(ctx: FirebaseAuthContext, user: User): Promise<Session> {
  const known = await getDoc(doc(ctx.db, USERS, user.uid));
  if (known.exists()) {
    const data = known.data() as DocumentData;
    return { trainerId: data.trainerId, clientId: data.clientId ?? null };
  }
  // Primera entrada de un entrenador: se le reconoce por el correo de su ficha, que se dio de alta
  // fuera de la app (no hay alta de entrenadores en el MVP).
  const trainers = await getDocs(
    query(collection(ctx.db, "trainers"), where("email", "in", emailVariants(user.email ?? ""))),
  );
  const trainerDoc = trainers.docs[0];
  if (!trainerDoc) {
    await signOut(ctx.auth);
    throw new DomainError("session.no_profile", "La cuenta no corresponde a nadie de la cartera");
  }
  const trainer = trainerSchema.parse({ ...trainerDoc.data(), id: trainerDoc.id });
  await writeBatch(ctx.db)
    .set(doc(ctx.db, USERS, user.uid), {
      role: "trainer",
      trainerId: trainer.id,
      clientId: null,
      email: trainer.email,
    })
    .commit();
  return { trainerId: trainer.id, clientId: null };
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
        url: ctx.inviteUrl,
        handleCodeInApp: true,
      });
    },
    isInvitationLink: (link) => isSignInWithEmailLink(ctx.auth, link),
    acceptInvitation: async ({ email, link, password }) => {
      if (!isSignInWithEmailLink(ctx.auth, link)) {
        throw new DomainError("invitation.invalid_link", "El enlace no es de invitación");
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
      // dirección. Si no hay cliente, la cuenta recién creada se deshace.
      const found = await getDocs(
        query(
          collection(ctx.db, "clients"),
          where("email", "in", emailVariants(email)),
          where("status", "==", "invitado"),
        ),
      );
      const clientDoc = found.docs[0];
      if (!clientDoc) {
        await deleteUser(user);
        throw new DomainError("invitation.not_found", "Ningún cliente invitado tiene ese correo");
      }
      const client = clientSchema.parse({ ...clientDoc.data(), id: clientDoc.id });
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
      return { trainerId: client.trainerId, clientId: client.id };
    },
  };
}
