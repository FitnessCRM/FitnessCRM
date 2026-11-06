import { DomainError } from "./errors";
import type { Client } from "./schemas";

/**
 * Versión vigente del texto de consentimiento del alta (C1, C2, I33). El texto vive en
 * `lib/i18n/es.ts` (`consent`). PENDIENTE DE VALIDAR: es un borrador escrito a partir de
 * `docs/dominio.md` §9 el 03-11-2026 y no es definitivo hasta que lo revise Dani (tarjeta 31; el
 * responsable del tratamiento sigue abierto en la tarjeta 117). Cambiar el texto es cambiar esta
 * versión: lo que un cliente aceptó antes no se reescribe.
 */
export const CONSENT_VERSION = "2026-11-03-borrador";

/**
 * I33: un cliente no pasa de `invitado` a `activo` sin aceptar el texto vigente. `accepted` es la
 * versión que el formulario dice haber enseñado y aceptado; cualquier otra cosa no vale.
 */
export function assertConsentAccepted(accepted: string | undefined): string {
  if (accepted !== CONSENT_VERSION) {
    throw new DomainError(
      "invitation.consent_required",
      "Sin aceptar el texto de consentimiento vigente, la cuenta no se activa (I33)",
    );
  }
  return accepted;
}

/**
 * E11 (I14): el borrado a petición solo se hace sobre un cliente de baja. Un cliente `invitado` o
 * `activo` primero se da de baja.
 */
export function assertErasable(client: Pick<Client, "status">): void {
  if (client.status !== "dado_de_baja") {
    throw new DomainError(
      "client.not_discharged",
      "Solo se borra definitivamente a un cliente dado de baja (I14)",
    );
  }
}

/**
 * E11: el borrado se confirma escribiendo el nombre del cliente, nombre y apellidos como se ven en
 * su ficha. No distingue mayúsculas ni espacios de más: lo que se pide es intención, no ortografía.
 */
export function confirmsClientName(
  client: Pick<Client, "firstName" | "lastName">,
  typed: string,
): boolean {
  const norm = (text: string) => text.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
  return norm(typed) !== "" && norm(typed) === norm(`${client.firstName} ${client.lastName}`);
}
