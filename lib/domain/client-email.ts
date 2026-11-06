import { DomainError } from "./errors";
import type { Client } from "./schemas";

/** Forma en que se comparan los correos: sin espacios alrededor y sin distinguir mayúsculas. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * I31 (E10): el email de un cliente es único en toda la plataforma, de cualquier entrenador. `except`
 * es el propio cliente cuando se edita, que no choca consigo mismo.
 */
export function isClientEmailTaken(
  email: string,
  clients: readonly Pick<Client, "id" | "email">[],
  except?: string,
): boolean {
  const wanted = normalizeEmail(email);
  return clients.some((c) => c.id !== except && normalizeEmail(c.email) === wanted);
}

export function clientEmailTakenError(): DomainError {
  return new DomainError("client.email_taken", "Ese correo ya es de otro cliente (I31)");
}

/** Si el cambio de ficha cambia de verdad el correo: mayúsculas y espacios no cuentan. */
export function changesClientEmail(current: Pick<Client, "email">, next: string | undefined) {
  return next !== undefined && normalizeEmail(next) !== normalizeEmail(current.email);
}

/**
 * I31 (E10): el correo solo se cambia mientras el cliente es `invitado`, y entonces la invitación se
 * reenvía al correo nuevo. Con el cliente `activo` o de baja, el correo es el de su cuenta y no se
 * cambia.
 */
export function assertClientEmailChange(
  current: Pick<Client, "email" | "status">,
  next: string | undefined,
): void {
  if (changesClientEmail(current, next) && current.status !== "invitado") {
    throw new DomainError(
      "client.email_locked",
      "El correo de un cliente solo se cambia mientras está invitado (I31)",
    );
  }
}
