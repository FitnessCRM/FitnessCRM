import type { Session } from "./session";

/**
 * Invitaciones (§7 y §12). La de un cliente: el entrenador lo da de alta con su correo, la app le
 * envía un enlace y es el propio cliente quien crea su contraseña; entrar con ese enlace es el paso
 * de `invitado` a `activo`. La de un entrenador: la deja la administración de la plataforma
 * (`trainerInvitations/{correo}`) y envía el enlace; aceptarla da de alta al entrenador.
 *
 * El enlace no lleva datos personales. Quien lo abre no escribe su correo cuando el backend ya lo
 * sabe: `readInvitation` lo dice y el formulario lo enseña, de solo lectura.
 */
export interface InvitationPort {
  /**
   * Envía (o reenvía) el enlace al correo del cliente. Solo a un cliente propio y `invitado`:
   * `not_found` si no es de ese entrenador, `invitation.not_invited` si ya entró o está de baja.
   */
  sendInvitation(trainerId: string, clientId: string): Promise<void>;
  /** Si la dirección que abre la persona es un enlace de invitación y no una ruta cualquiera. */
  isInvitationLink(link: string): boolean;
  /**
   * Abre el enlace y dice a qué correo va. `email` es `null` si el backend no lo sabe hasta que la
   * persona lo escribe (Firebase): entonces el formulario pide el correo y se pasa en `acceptInvitation`.
   * `invitation.invalid_link` si el enlace caducó, ya se usó o no es de invitación.
   */
  readInvitation(link: string): Promise<{ email: string | null }>;
  /**
   * Completa la invitación que diga el enlace (`invitationKind`): fija la contraseña; la de un cliente
   * lo activa, la de un entrenador crea su ficha y lo deja dado de alta. Devuelve la sesión ya abierta.
   * `email` solo hace falta si `readInvitation` devolvió `null`; si se pasa, debe ser el invitado.
   * Errores: `invitation.invalid_link` si el enlace no sirve; `invitation.weak_password` si la
   * contraseña es corta (sin gastar el enlace); `invitation.email_required` si falta el correo y
   * hacía falta; `invitation.email_mismatch` si el correo no es el invitado (sin gastar el enlace);
   * `invitation.not_found` si no hay invitación pendiente para ese correo o cliente; e
   * `invitation.already_registered` si el correo ya es de una cuenta de la app (solo entrenadores),
   * que queda como estaba.
   */
  acceptInvitation(input: { link: string; password: string; email?: string }): Promise<Session>;
}
