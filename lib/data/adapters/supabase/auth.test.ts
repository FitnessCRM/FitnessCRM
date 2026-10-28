import { FunctionsHttpError } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "./client";
import { createInvitationPort, createPasswordResetPort } from "./auth";

const TRAINER_ID = "11111111-1111-1111-1111-111111111111";
const CLIENT_ID = "c1000000-0000-0000-0000-000000000001";
const APP = "https://127.0.0.1:3000";

/** Un cliente de Supabase en el que cada llamada falla si no se espera: nada de red. */
function fakeClient(overrides: Record<string, unknown> = {}): SupabaseClient {
  return overrides as unknown as SupabaseClient;
}

describe("createInvitationPort.isInvitationLink", () => {
  const port = createInvitationPort(fakeClient());

  it("recognizes the link of a client invitation", () => {
    expect(
      port.isInvitationLink(`${APP}/accept-invite?c=${CLIENT_ID}&token_hash=abc&type=invite`),
    ).toBe(true);
  });

  it("recognizes the link of a trainer invitation", () => {
    expect(
      port.isInvitationLink(`${APP}/accept-invite?kind=trainer&token_hash=abc&type=invite`),
    ).toBe(true);
  });

  it("rejects a recovery link, a link without code, and a link that says no one", () => {
    expect(port.isInvitationLink(`${APP}/login?token_hash=abc&type=recovery`)).toBe(false);
    expect(port.isInvitationLink(`${APP}/accept-invite?c=${CLIENT_ID}&type=invite`)).toBe(false);
    expect(port.isInvitationLink(`${APP}/accept-invite?token_hash=abc&type=invite`)).toBe(false);
  });
});

describe("createInvitationPort.readInvitation", () => {
  it("verifies the link once and returns the email of the account it opens", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({
      data: { user: { email: "angela@test.local" } },
      error: null,
    });
    const port = createInvitationPort(fakeClient({ auth: { verifyOtp } }));

    await expect(
      port.readInvitation(`${APP}/accept-invite?c=${CLIENT_ID}&token_hash=abc&type=invite`),
    ).resolves.toEqual({ email: "angela@test.local" });
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type: "invite" });
  });

  it("rejects a link that is not an invitation without calling the backend", async () => {
    const verifyOtp = vi.fn();
    const port = createInvitationPort(fakeClient({ auth: { verifyOtp } }));

    await expect(port.readInvitation(`${APP}/accept-invite?c=${CLIENT_ID}`)).rejects.toMatchObject({
      code: "invitation.invalid_link",
    });
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});

describe("createInvitationPort.acceptInvitation", () => {
  const link = `${APP}/accept-invite?c=${CLIENT_ID}&token_hash=abc&type=invite`;

  it("rejects a weak password without calling the backend", async () => {
    const rpc = vi.fn();
    const port = createInvitationPort(fakeClient({ rpc }));

    await expect(port.acceptInvitation({ link, password: "123" })).rejects.toMatchObject({
      code: "invitation.weak_password",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a link that is not an invitation without calling the backend", async () => {
    const rpc = vi.fn();
    const port = createInvitationPort(fakeClient({ rpc }));

    await expect(
      port.acceptInvitation({ link: `${APP}/accept-invite?c=${CLIENT_ID}`, password: "secreta1" }),
    ).rejects.toMatchObject({ code: "invitation.invalid_link" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("activates the client through its RPC and closes the session when the RPC refuses", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "invitation.not_found" },
    });
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const port = createInvitationPort(fakeClient({ rpc, auth: { signOut } }));

    await expect(port.acceptInvitation({ link, password: "secreta1" })).rejects.toMatchObject({
      code: "invitation.not_found",
    });
    expect(rpc).toHaveBeenCalledWith("accept_client_invitation", { p_client_id: CLIENT_ID });
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});

describe("createInvitationPort.sendInvitation", () => {
  it("keeps the code the invite function answers with", async () => {
    const response = new Response(JSON.stringify({ code: "invitation.not_invited" }), {
      status: 409,
    });
    const invoke = vi
      .fn()
      .mockResolvedValue({ data: null, error: new FunctionsHttpError(response) });
    const port = createInvitationPort(fakeClient({ functions: { invoke } }));

    await expect(port.sendInvitation(TRAINER_ID, CLIENT_ID)).rejects.toMatchObject({
      code: "invitation.not_invited",
    });
    expect(invoke).toHaveBeenCalledWith("invite-client", {
      body: { trainerId: TRAINER_ID, clientId: CLIENT_ID },
    });
  });
});

describe("createPasswordResetPort", () => {
  const redirectTo = `${APP}/reset-password`;

  it("rejects something that is not an email before asking the backend", async () => {
    const resetPasswordForEmail = vi.fn();
    const port = createPasswordResetPort(fakeClient({ auth: { resetPasswordForEmail } }), {
      redirectTo,
    });

    await expect(port.sendPasswordReset("no-es-un-correo")).rejects.toMatchObject({
      code: "password_reset.invalid_email",
    });
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("rejects a short new password before touching the code", async () => {
    const verifyOtp = vi.fn();
    const port = createPasswordResetPort(fakeClient({ auth: { verifyOtp } }), { redirectTo });

    await expect(port.confirmPasswordReset({ code: "abc", password: "123" })).rejects.toMatchObject(
      { code: "password_reset.weak_password" },
    );
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});
