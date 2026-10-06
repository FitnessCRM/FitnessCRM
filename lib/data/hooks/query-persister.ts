import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";
import { del, get, set } from "idb-keyval";
import type { Query } from "@tanstack/react-query";
import { queryKeys } from "./query-keys";

const STORAGE_KEY = "hector-query-cache";
const WRITE_DELAY_MS = 1000;

/** Una semana: lo bastante para un gimnasio sin cobertura, sin dejar datos viejos para siempre. */
export const PERSIST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Se guarda lo que ya llegó bien, salvo la sesión: restaurarla de disco daría por válida una
 * sesión que el backend puede haber cerrado, y en un dispositivo compartido enseñaría la de otra
 * persona. La sesión la resuelve siempre el puerto, que offline la lee de su propio almacén.
 */
export function shouldPersistQuery(query: Query): boolean {
  return query.state.status === "success" && query.queryKey[0] !== queryKeys.session[0];
}

/**
 * Persiste la caché de TanStack Query en IndexedDB. Escribe con retardo para no serializar toda
 * la caché en cada cambio. En el servidor, o sin IndexedDB, no hace nada: la app sigue sin
 * lectura offline pero no falla.
 */
export function createIdbPersister(): Persister {
  const available = typeof indexedDB !== "undefined";
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: PersistedClient | undefined;

  const flush = () => {
    timer = undefined;
    if (!pending) return;
    const client = pending;
    pending = undefined;
    void set(STORAGE_KEY, client).catch(() => {});
  };

  return {
    persistClient: (client) => {
      if (!available) return;
      pending = client;
      timer ??= setTimeout(flush, WRITE_DELAY_MS);
    },
    restoreClient: async () => {
      if (!available) return undefined;
      try {
        return await get<PersistedClient>(STORAGE_KEY);
      } catch {
        return undefined;
      }
    },
    removeClient: async () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
      pending = undefined;
      if (!available) return;
      try {
        await del(STORAGE_KEY);
      } catch {
        /* sin almacén no hay nada que borrar */
      }
    },
  };
}

/** Borra la caché guardada en el dispositivo, sin pasar por el persister montado (cerrar sesión). */
export async function clearPersistedCache(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    await del(STORAGE_KEY);
  } catch {
    /* sin almacén no hay nada que borrar */
  }
}
