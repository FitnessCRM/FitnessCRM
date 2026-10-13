import { DomainError } from "./errors";
import type { ClientStatus } from "./schemas";

/**
 * Transiciones válidas del estado del cliente (§7, H6). Solo estas tres: una invitación sin aceptar
 * no tiene baja, y de «dado de baja» solo se sale reactivando. Pasar al mismo estado no cuenta.
 */
const NEXT: Record<ClientStatus, readonly ClientStatus[]> = {
  invitado: ["activo"],
  activo: ["dado_de_baja"],
  dado_de_baja: ["activo"],
};

export function canChangeClientStatus(from: ClientStatus, to: ClientStatus): boolean {
  return from === to || NEXT[from].includes(to);
}

export function assertClientStatusChange(from: ClientStatus, to: ClientStatus): void {
  if (!canChangeClientStatus(from, to)) {
    throw new DomainError(
      "client.invalid_transition",
      `Un cliente no pasa de ${from} a ${to} (§7)`,
    );
  }
}
