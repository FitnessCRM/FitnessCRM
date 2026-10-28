import { DomainError } from "@/lib/domain";

/** Lo que PostgREST y supabase-js devuelven como error: `code` es el SQLSTATE cuando lo hay. */
export interface BackendError {
  code?: string;
  message: string;
}

/**
 * Las RPC lanzan los códigos del dominio como mensaje (`RAISE EXCEPTION 'client.not_writable'`, con
 * SQLSTATE P0001). Eso pasa a `DomainError`. Cualquier otro error (red, permisos, restricciones) sale
 * como error normal, sin disfrazarlo de error de negocio.
 */
export function toDomainError(error: BackendError): Error {
  if (error.code === "P0001") {
    // Todo `*.not_found` de las funciones es el mismo caso para el puerto: `not_found`.
    const code = error.message.endsWith(".not_found") ? "not_found" : error.message;
    return new DomainError(code, error.message);
  }
  return Object.assign(new Error(error.message), { code: error.code });
}

/** Lanza si la consulta falló. Las consultas sin error pueden seguir devolviendo `null` a propósito. */
export function raise(error: BackendError | null): void {
  if (error) throw toDomainError(error);
}

export function notFoundError(what: string): DomainError {
  return new DomainError("not_found", `${what} no encontrado`);
}
