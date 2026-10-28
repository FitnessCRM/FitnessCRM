import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseConfig {
  url: string;
  /** Clave pública (anon). Va al navegador; la seguridad la pone RLS, no la clave. */
  anonKey: string;
}

/** Cliente del navegador: guarda la sesión en cookies, que es lo que lee el servidor de Next. */
export function createSupabaseClient(config: SupabaseConfig): SupabaseClient {
  return createBrowserClient(config.url, config.anonKey);
}

export type { SupabaseClient };
