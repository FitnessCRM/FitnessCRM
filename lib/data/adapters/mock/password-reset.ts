import type { PasswordResetPort } from "@/lib/data/ports";
import { DomainError, emailSchema } from "@/lib/domain";
import type { MockContext } from "./store";

/** Código de recuperación de la demo: no sale de la memoria, pero respeta el mismo contrato. */
export const MOCK_RESET_CODE = "demo";

/** Longitud mínima de contraseña de Firebase; el mock la imita para probar la pantalla igual. */
const MIN_PASSWORD_LENGTH = 6;

/**
 * Recuperación de la demo. Nadie recibe correos: con `MOCK_RESET_CODE` en el enlace
 * (`/reset-password?oobCode=demo`) se recorre la pantalla. El código se gasta al usarse, como el real.
 */
export function createPasswordResetPort(ctx: MockContext): PasswordResetPort {
  let spent = false;
  const assertValid = (code: string) => {
    if (code !== MOCK_RESET_CODE || spent) {
      throw new DomainError("password_reset.invalid_link", "El enlace caducó o ya se usó");
    }
  };
  return {
    sendPasswordReset: async (email) => {
      if (!emailSchema.safeParse(email).success) {
        throw new DomainError("password_reset.invalid_email", "No es un correo");
      }
      return ctx.reply(undefined);
    },
    checkPasswordResetCode: async (code) => {
      assertValid(code);
      const account = ctx.state.clients[0];
      return ctx.reply({ email: account?.email ?? "demo@hector.test" });
    },
    confirmPasswordReset: async ({ code, password }) => {
      assertValid(code);
      if (password.length < MIN_PASSWORD_LENGTH) {
        throw new DomainError("password_reset.weak_password", "La contraseña es demasiado corta");
      }
      spent = true;
      return ctx.reply(undefined);
    },
  };
}
