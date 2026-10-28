import { AuthApiError, FunctionsHttpError } from "@supabase/supabase-js";
import type { InvitationPort, PasswordResetPort, Session } from "@/lib/data/ports";
import { DomainError, emailSchema } from "@/lib/domain";
import { invitationKind } from "@/lib/domain/invitation-link";
import type { SupabaseClient } from "./client";
import { raise, toDomainError, type BackendError } from "./errors";
import { claimsOf, sessionFromClaims } from "./session";

/** Supabase Auth exige al menos 6 caracteres (`minimum_password_length` en supabase/config.toml). */
const MIN_PASSWORD_LENGTH = 6;

/** Función que envía la invitación de un cliente; la clave de servicio solo vive en ella. */
const INVITE_FUNCTION = "invite-client";

type InviteLink =
  { tokenHash: string; kind: "trainer" } | { tokenHash: string; kind: "client"; clientId: string };

/**
 * Lo que trae el enlace del correo: el código (`token_hash`, de un solo uso) y a quién invita. El
 * enlace lo arma la plantilla del correo con `RedirectTo`, que lleva `?c=` (cliente) o `?kind=trainer`.
 */
function inviteLinkOf(link: string): InviteLink | null {
  const url = parseUrl(link);
  if (!url || url.searchParams.get("type") !== "invite") return null;
  const tokenHash = url.searchParams.get("token_hash");
  if (!tokenHash) return null;
  switch (invitationKind(link)) {
    case "trainer":
      return { tokenHash, kind: "trainer" };
    case "client": {
      const clientId = url.searchParams.get("c");
      return clientId ? { tokenHash, kind: "client", clientId } : null;
    }
    default:
      return null;
  }
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * Las funciones de la base lanzan los `invitation.*` como mensaje, y `toDomainError` los reduciría a
 * `not_found`: estos se conservan tal cual, que es lo que el puerto distingue.
 */
function invitationRpcError(error: BackendError): Error {
  return error.code === "P0001" && error.message.startsWith("invitation.")
    ? new DomainError(error.message, error.message)
    : toDomainError(error);
}

/** La función devuelve su error como `{ code, message }` en el cuerpo; cualquier otro fallo sale tal cual. */
async function sendFailure(error: Error): Promise<Error> {
  if (!(error instanceof FunctionsHttpError)) return error;
  const body = (await error.context.json().catch(() => null)) as {
    code?: unknown;
    message?: unknown;
  } | null;
  if (typeof body?.code !== "string") return error;
  return new DomainError(body.code, typeof body.message === "string" ? body.message : body.code);
}

const invalidLink = (message: string) => new DomainError("invitation.invalid_link", message);
const weakPassword = () =>
  new DomainError("invitation.weak_password", "La contraseña es demasiado corta");

/**
 * Invitaciones (§7 y §12) sobre Supabase Auth. El enlace lleva el `token_hash` de la invitación: al
 * abrirlo se verifica con `verifyOtp`, que da la sesión del invitado. El envío va por una Edge
 * Function, porque invitar a un correo nuevo exige la clave de servicio, que no puede estar en el
 * navegador.
 */
export function createInvitationPort(client: SupabaseClient): InvitationPort {
  return {
    sendInvitation: async (trainerId, clientId) => {
      const { error } = await client.functions.invoke(INVITE_FUNCTION, {
        body: { trainerId, clientId },
      });
      if (error) throw await sendFailure(error);
    },

    isInvitationLink: (link) => inviteLinkOf(link) !== null,

    // Verificar el enlace da la sesión del invitado y su correo, que es el de la cuenta: nadie lo escribe.
    // Gasta el enlace, así que solo se llama una vez, al abrir la página.
    readInvitation: async (link) => {
      const invite = inviteLinkOf(link);
      if (!invite) {
        throw invalidLink("El enlace no es de invitación o no dice a quién invita");
      }
      const { data, error } = await client.auth.verifyOtp({
        token_hash: invite.tokenHash,
        type: "invite",
      });
      if (error) {
        if (error instanceof AuthApiError) throw invalidLink("El enlace caducó o ya se usó");
        throw error;
      }
      const email = data.user?.email;
      if (!email) throw invalidLink("El enlace no lleva ninguna cuenta");
      return { email };
    },

    // Usa la sesión que dejó `readInvitation`: el enlace ya se verificó y no se vuelve a gastar. El
    // correo que llega en `email` no hace falta aquí: la base ya sabe de qué cuenta es la sesión.
    acceptInvitation: async ({ link, password }) => {
      const invite = inviteLinkOf(link);
      if (!invite) {
        throw invalidLink("El enlace no es de invitación o no dice a quién invita");
      }
      if (password.length < MIN_PASSWORD_LENGTH) throw weakPassword();

      return invite.kind === "client"
        ? acceptClientInvitation(client, invite.clientId, password)
        : acceptTrainerInvitation(client, password);
    },
  };
}

/**
 * Primer acceso de un cliente: la base lo activa y crea su perfil, y después se fija la contraseña.
 * Va primero para que una cuenta que ya es de alguien no vea cambiada su contraseña.
 */
async function acceptClientInvitation(
  client: SupabaseClient,
  clientId: string,
  password: string,
): Promise<Session> {
  const { error } = await client.rpc("accept_client_invitation", { p_client_id: clientId });
  if (error) {
    await client.auth.signOut({ scope: "local" });
    throw invitationRpcError(error);
  }
  return setPasswordAndSession(client, password);
}

/** Alta de un entrenador invitado por la administración: la base crea su ficha y su perfil. */
async function acceptTrainerInvitation(client: SupabaseClient, password: string): Promise<Session> {
  const { error } = await client.rpc("accept_trainer_invitation");
  if (error) {
    await client.auth.signOut({ scope: "local" });
    throw invitationRpcError(error);
  }
  return setPasswordAndSession(client, password);
}

/**
 * Fija la contraseña y devuelve la sesión con los claims nuevos: el alta ya cambió el rol del token,
 * así que se refresca antes de leerlo.
 */
async function setPasswordAndSession(client: SupabaseClient, password: string): Promise<Session> {
  const { error } = await client.auth.updateUser({ password });
  if (error) {
    if (error.code === "weak_password") throw weakPassword();
    throw error;
  }
  const { data, error: refreshError } = await client.auth.refreshSession();
  if (refreshError) throw refreshError;
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new DomainError("session.no_profile", "La cuenta no corresponde a nadie de la cartera");
  }
  return sessionFromClaims(claimsOf(accessToken));
}

/**
 * Recuperar la contraseña (§12). El enlace del correo lleva `token_hash` con tipo `recovery`, igual
 * que la invitación. `redirectTo` es la página de la app que recibe ese enlace.
 */
export function createPasswordResetPort(
  client: SupabaseClient,
  options: { redirectTo: string },
): PasswordResetPort {
  const invalidResetLink = () =>
    new DomainError("password_reset.invalid_link", "El enlace caducó o ya se usó");
  const resetWeakPassword = () =>
    new DomainError("password_reset.weak_password", "La contraseña es demasiado corta");

  /** Verifica el enlace y devuelve el correo de su cuenta. Abre sesión, que es lo que cambia la contraseña. */
  const verifyRecovery = async (code: string): Promise<string> => {
    const { data, error } = await client.auth.verifyOtp({ token_hash: code, type: "recovery" });
    if (error) {
      if (error instanceof AuthApiError) throw invalidResetLink();
      throw error;
    }
    if (!data.user?.email) throw invalidResetLink();
    return data.user.email;
  };

  return {
    sendPasswordReset: async (email) => {
      if (!emailSchema.safeParse(email).success) {
        throw new DomainError("password_reset.invalid_email", "No es un correo");
      }
      // Supabase no dice si el correo tiene cuenta: el envío resuelve igual, como el puerto pide.
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: options.redirectTo,
      });
      if (error) throw error;
    },

    checkPasswordResetCode: async (code) => ({ email: await verifyRecovery(code) }),

    confirmPasswordReset: async ({ code, password }) => {
      if (password.length < MIN_PASSWORD_LENGTH) throw resetWeakPassword();
      const { data, error } = await client.auth.getSession();
      raise(error);
      // Tras comprobar el código ya hay sesión; si la página se recargó, el código aún sirve.
      if (!data.session) await verifyRecovery(code);

      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) {
        if (updateError.code === "weak_password") throw resetWeakPassword();
        throw updateError;
      }
      // El puerto no abre sesión: quien cambia la contraseña vuelve a entrar con ella.
      const { error: signOutError } = await client.auth.signOut({ scope: "local" });
      if (signOutError) throw signOutError;
    },
  };
}
