import type { SessionPort, Session } from "@/lib/data/ports";
import { DomainError } from "@/lib/domain";
import type { SupabaseClient } from "./client";

/**
 * Claims que pone el hook de acceso (supabase/migrations/20261028120100_access_token_hook.sql). Son
 * la única fuente del rol: la sesión no consulta ninguna tabla para saber quién es.
 */
export interface AccessClaims {
  user_role?: string;
  trainer_id?: string;
  client_id?: string;
}

const SIGNED_OUT: Session = { trainerId: "", clientId: null, role: null };

/**
 * Traduce los claims a la sesión del dominio. Una cuenta sin rol de entrenador o de cliente (la
 * administración de la plataforma, o un alta que no terminó) no es nadie de la cartera: lanza
 * `session.no_profile`, igual que el adaptador de Firebase.
 */
export function sessionFromClaims(claims: AccessClaims): Session {
  if (claims.user_role === "trainer" && claims.trainer_id) {
    return { trainerId: claims.trainer_id, clientId: null, role: "trainer" };
  }
  if (claims.user_role === "client" && claims.trainer_id && claims.client_id) {
    return { trainerId: claims.trainer_id, clientId: claims.client_id, role: "client" };
  }
  throw new DomainError("session.no_profile", "La cuenta no corresponde a nadie de la cartera");
}

/** Lee el payload de un JWT (base64url) sin verificar la firma: la verifica Supabase, no la app. */
export function claimsOf(accessToken: string): AccessClaims {
  const payload = accessToken.split(".")[1] ?? "";
  const base64 = payload
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(payload.length / 4) * 4, "=");
  return JSON.parse(atob(base64)) as AccessClaims;
}

export function createSessionPort(client: SupabaseClient): SessionPort {
  const resolve = async (accessToken: string): Promise<Session> => {
    try {
      return sessionFromClaims(claimsOf(accessToken));
    } catch (error) {
      await client.auth.signOut();
      throw error;
    }
  };

  return {
    getSession: async () => {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      const accessToken = data.session?.access_token;
      return accessToken ? resolve(accessToken) : SIGNED_OUT;
    },
    login: async (email, password) => {
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        if (error.code === "invalid_credentials") {
          throw new DomainError("session.invalid_credentials", "Correo o contraseña incorrectos");
        }
        throw error;
      }
      return resolve(data.session.access_token);
    },
    logout: async () => {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },
  };
}
