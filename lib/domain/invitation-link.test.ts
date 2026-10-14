import { describe, expect, it } from "vitest";
import { invitationKind } from "./invitation-link";

const ACCEPT = "https://app.test/accept-invite";

/** El enlace del correo: la página de Firebase, con la de la app dentro de `continueUrl`. */
const emailLink = (continueUrl: string) =>
  `https://hector.firebaseapp.com/__/auth/action?apiKey=k&mode=signIn&oobCode=abc&continueUrl=${encodeURIComponent(continueUrl)}`;

describe("invitationKind", () => {
  it("a trainer invitation says kind=trainer, directly or inside continueUrl", () => {
    expect(invitationKind(`${ACCEPT}?kind=trainer&apiKey=k&oobCode=abc&mode=signIn`)).toBe(
      "trainer",
    );
    expect(invitationKind(emailLink(`${ACCEPT}?kind=trainer`))).toBe("trainer");
  });

  it("a client invitation carries the client id (c=), directly or inside continueUrl", () => {
    expect(invitationKind(`${ACCEPT}?c=c-1&apiKey=k&oobCode=abc&mode=signIn`)).toBe("client");
    expect(invitationKind(emailLink(`${ACCEPT}?c=c-1`))).toBe("client");
  });

  it("a link that says neither, or is not a link, invites nobody", () => {
    expect(invitationKind(`${ACCEPT}?apiKey=k&oobCode=abc&mode=signIn`)).toBeNull();
    expect(invitationKind(emailLink(ACCEPT))).toBeNull();
    expect(invitationKind(`${ACCEPT}?kind=admin`)).toBeNull();
    expect(invitationKind(`${ACCEPT}?c=`)).toBeNull();
    expect(invitationKind(emailLink("no es una dirección"))).toBeNull();
    expect(invitationKind("no es una dirección")).toBeNull();
  });

  it("the trainer kind wins over a client id in the same link", () => {
    expect(invitationKind(`${ACCEPT}?kind=trainer&c=c-1`)).toBe("trainer");
  });
});
