/**
 * Recuperar la contraseña (§12). Quien la ha perdido pide un enlace con su correo, abre el enlace
 * del correo y escribe una contraseña nueva; después vuelve a entrar con ella.
 *
 * Es para quien ya tiene cuenta. Un cliente `invitado` aún no la tiene (la crea al aceptar su
 * invitación) y lo que le toca es ese enlace, no este.
 */
export interface PasswordResetPort {
  /**
   * Pide el enlace. **Nunca dice si el correo tiene cuenta**: resuelve igual exista o no, para que
   * nadie pueda usarlo para saber quién usa la app. `password_reset.invalid_email` si lo escrito
   * no es un correo.
   */
  sendPasswordReset(email: string): Promise<void>;
  /**
   * Comprueba el código que lleva el enlace del correo y devuelve el correo de la cuenta, para
   * enseñarlo. `password_reset.invalid_link` si caducó o ya se usó.
   */
  checkPasswordResetCode(code: string): Promise<{ email: string }>;
  /**
   * Fija la contraseña nueva y gasta el código. No abre sesión: se vuelve a entrar con ella.
   * `password_reset.invalid_link` si el código caducó o ya se usó y `password_reset.weak_password`
   * si la contraseña es demasiado corta.
   */
  confirmPasswordReset(input: { code: string; password: string }): Promise<void>;
}
