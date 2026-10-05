import type { Session } from "./session";

/**
 * Invitación de un cliente (§7): el entrenador lo da de alta con su correo, la app le envía un
 * enlace y es el propio cliente quien crea su contraseña. Entrar con ese enlace es el paso de
 * `invitado` a `activo`.
 *
 * El enlace no lleva datos personales: el correo lo vuelve a escribir quien lo recibe, porque el
 * navegador que lo abre casi nunca es el del entrenador que lo envió.
 */
export interface InvitationPort {
  /**
   * Envía (o reenvía) el enlace al correo del cliente. Solo a un cliente propio y `invitado`:
   * `not_found` si no es de ese entrenador, `invitation.not_invited` si ya entró o está de baja.
   */
  sendInvitation(trainerId: string, clientId: string): Promise<void>;
  /** Si la dirección que abre el cliente es un enlace de invitación y no una ruta cualquiera. */
  isInvitationLink(link: string): boolean;
  /**
   * Completa la invitación: entra con el enlace, fija la contraseña y activa al cliente. Devuelve
   * la sesión ya abierta. `invitation.invalid_link` si el enlace caducó o ya se usó,
   * `invitation.email_mismatch` si el correo no es el invitado y `invitation.not_found` si ningún
   * cliente `invitado` tiene ese correo.
   */
  acceptInvitation(input: { email: string; link: string; password: string }): Promise<Session>;
}
