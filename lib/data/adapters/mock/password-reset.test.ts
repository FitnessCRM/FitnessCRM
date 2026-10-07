import { describe, expect, it } from "vitest";
import { createMockPorts } from "./index";
import { MOCK_RESET_CODE } from "./password-reset";

describe("mock: recovering a password", () => {
  it("asking for the link resolves for any well-formed email, so it never says who has an account", async () => {
    const { passwordReset } = createMockPorts();
    await expect(passwordReset.sendPasswordReset("marta@hector.test")).resolves.toBeUndefined();
    await expect(passwordReset.sendPasswordReset("nadie@nada.test")).resolves.toBeUndefined();
  });

  it("rejects something that is not an email", async () => {
    const { passwordReset } = createMockPorts();
    await expect(passwordReset.sendPasswordReset("no es un correo")).rejects.toMatchObject({
      code: "password_reset.invalid_email",
    });
  });

  it("checks the code of the link and tells which account it is for", async () => {
    const { passwordReset } = createMockPorts();
    await expect(passwordReset.checkPasswordResetCode(MOCK_RESET_CODE)).resolves.toMatchObject({
      email: expect.stringContaining("@"),
    });
    await expect(passwordReset.checkPasswordResetCode("otro")).rejects.toMatchObject({
      code: "password_reset.invalid_link",
    });
  });

  it("a weak password does not spend the code, a good one does", async () => {
    const { passwordReset } = createMockPorts();
    await expect(
      passwordReset.confirmPasswordReset({ code: MOCK_RESET_CODE, password: "corta" }),
    ).rejects.toMatchObject({ code: "password_reset.weak_password" });
    await expect(
      passwordReset.confirmPasswordReset({ code: MOCK_RESET_CODE, password: "secreto-2" }),
    ).resolves.toBeUndefined();
    // El código es de un solo uso, como el real.
    await expect(passwordReset.checkPasswordResetCode(MOCK_RESET_CODE)).rejects.toMatchObject({
      code: "password_reset.invalid_link",
    });
    await expect(
      passwordReset.confirmPasswordReset({ code: MOCK_RESET_CODE, password: "secreto-3" }),
    ).rejects.toMatchObject({ code: "password_reset.invalid_link" });
  });
});
