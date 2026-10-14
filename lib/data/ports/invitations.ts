import type { Session } from "./session";

/**
 * Invitaciones (§7 y §12). La de un cliente: el entrenador lo da de alta con su correo, la app le
 * envía un enlace y es el propio cliente quien crea su contraseña; entrar con ese enlace es el paso
 * de `invitado` a `activo`. La de un entrenador: la deja la administración de la plataforma
 * (`trainerInvitations/{correo}`) y envía el enlace; aceptarla da de alta al entrenador.
 *
 * El enlace no lleva datos personales: el correo lo vuelve a escribir quien lo recibe, porque el
 * navegador que lo abre casi nunca es el de quien lo envió.
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
   * Completa la invitación que diga el enlace (`invitationKind`): entra con él y fija la
   * contraseña; la de un cliente lo activa, la de un entrenador crea su ficha y lo deja dado de alta.
   * Devuelve la sesión ya abierta. Errores: `invitation.invalid_link` si el enlace caducó, ya se usó
   * o no dice a quién invita; `invitation.weak_password` si la contraseña es corta (sin gastar el
   * enlace); `invitation.email_mismatch` si el correo no es el invitado; `invitation.not_found` si
   * no hay invitación pendiente (cliente `invitado` o invitación de entrenador) para ese correo; e
   * `invitation.already_registered` si el correo ya es de una cuenta de la app (solo entrenadores),
   * que queda como estaba.
   */
  acceptInvitation(input: { email: string; link: string; password: string }): Promise<Session>;
}
