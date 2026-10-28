"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAcceptInvitation, useIsInvitationLink, useReadInvitation } from "@/lib/data/hooks";
import { DomainError } from "@/lib/domain";
import { invitationKind } from "@/lib/domain/invitation-link";
import { es } from "@/lib/i18n/es";
import { homePath } from "@/lib/session-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LinkState = "checking" | "valid" | "invalid" | "unreadable";

const copy = es.pages.acceptInvite;

/**
 * Qué dice el formulario de cada fallo del puerto; lo que no conoce es un fallo de conexión. Sin
 * invitación pendiente, al entrenador se le habla de la suya.
 */
function messageFor(error: unknown, forTrainer: boolean): string {
  if (error instanceof DomainError) {
    switch (error.code) {
      case "invitation.weak_password":
        return copy.form.errorWeak;
      case "invitation.email_mismatch":
      case "invitation.email_required":
        return copy.form.errorEmail;
      case "invitation.not_found":
        return forTrainer ? copy.trainer.errorNotFound : copy.form.errorNotFound;
      case "invitation.already_registered":
        return copy.form.errorRegistered;
    }
  }
  return copy.form.errorNetwork;
}

export function AcceptInviteForm() {
  const router = useRouter();
  const isInvitationLink = useIsInvitationLink();
  const { mutate: read } = useReadInvitation();
  const { mutate: accept, isPending } = useAcceptInvitation();
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [forTrainer, setForTrainer] = useState(false);
  // El correo que dice el enlace; `null` si la persona tiene que escribirlo (Firebase).
  const [knownEmail, setKnownEmail] = useState<string | null>(null);
  const [typedEmail, setTypedEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Leer el enlace lo gasta: en el modo estricto de desarrollo el efecto corre dos veces.
  const started = useRef(false);

  // La dirección solo existe en el navegador: no se puede saber en el servidor si el enlace vale, ni
  // si invita a un cliente o a un entrenador.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const link = window.location.href;
    if (!isInvitationLink(link)) return setLinkState("invalid");
    setForTrainer(invitationKind(link) === "trainer");
    read(link, {
      onSuccess: ({ email }) => {
        setKnownEmail(email);
        setLinkState("valid");
      },
      onError: (failure) => {
        const invalid =
          failure instanceof DomainError && failure.code === "invitation.invalid_link";
        setLinkState(invalid ? "invalid" : "unreadable");
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el puerto es estable y el enlace se lee una vez
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const email = knownEmail ?? typedEmail;
    if (!email || !password || !confirm) return setError(copy.form.required);
    if (password !== confirm) return setError(copy.form.errorMismatch);
    accept(
      {
        link: window.location.href,
        password,
        email: knownEmail === null ? typedEmail : undefined,
      },
      {
        onSuccess: (session) => router.push(homePath(session)),
        onError: (failure) => {
          // Un enlace caducado o ya usado no se arregla reintentando: se cambia de pantalla.
          if (failure instanceof DomainError && failure.code === "invitation.invalid_link") {
            setLinkState("invalid");
          } else {
            setError(messageFor(failure, forTrainer));
          }
        },
      },
    );
  };

  if (linkState === "checking") {
    return <p className="text-text-muted text-sm">{copy.checking}</p>;
  }

  if (linkState === "invalid" || linkState === "unreadable") {
    return (
      <div className="w-full max-w-[360px]">
        <div className="bg-surface-raised border-border-subtle rounded-xl border p-8">
          <h1 className="font-display text-display-sm font-bold uppercase">{copy.invalid.title}</h1>
          <p className="text-text-muted mt-2 text-sm">
            {linkState === "unreadable"
              ? copy.form.errorNetwork
              : forTrainer
                ? copy.trainer.invalidDescription
                : copy.invalid.description}
          </p>
          <Link
            href="/login"
            className="text-accent hover:text-accent-hover mt-6 flex min-h-8 items-center text-sm"
          >
            {copy.invalid.toLogin}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[360px]">
      <div className="bg-surface-raised border-border-subtle rounded-xl border p-8">
        <h1 className="font-display text-display-sm font-bold uppercase">{copy.title}</h1>
        <p className="text-text-muted mt-2 text-sm">
          {forTrainer ? copy.trainer.subtitle : copy.subtitle}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">{copy.form.email}</Label>
            {knownEmail === null ? (
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={typedEmail}
                onChange={(e) => setTypedEmail(e.target.value)}
                disabled={isPending}
              />
            ) : (
              <Input id="email" type="email" value={knownEmail} readOnly />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{copy.form.password}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isPending}
            />
            <p className="text-text-subtle text-xs">{copy.form.passwordHint}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">{copy.form.confirm}</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={isPending}
            />
          </div>

          {error && (
            <div role="alert" className="bg-danger-soft text-danger rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={isPending}
            className="bg-accent text-on-accent hover:bg-accent-hover w-full"
          >
            {isPending ? copy.form.submitting : copy.form.submit}
          </Button>
        </form>
      </div>
    </div>
  );
}
