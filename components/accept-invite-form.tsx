"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAcceptInvitation, useIsInvitationLink } from "@/lib/data/hooks";
import { DomainError } from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { homePath } from "@/lib/session-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LinkState = "checking" | "valid" | "invalid";

const copy = es.pages.acceptInvite;

/** Qué dice el formulario de cada fallo del puerto; lo que no conoce es un fallo de conexión. */
function messageFor(error: unknown): string {
  if (error instanceof DomainError) {
    switch (error.code) {
      case "invitation.weak_password":
        return copy.form.errorWeak;
      case "invitation.email_mismatch":
        return copy.form.errorEmail;
      case "invitation.not_found":
        return copy.form.errorNotFound;
    }
  }
  return copy.form.errorNetwork;
}

export function AcceptInviteForm() {
  const router = useRouter();
  const isInvitationLink = useIsInvitationLink();
  const { mutate: accept, isPending } = useAcceptInvitation();
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  // La dirección solo existe en el navegador: no se puede saber en el servidor si el enlace vale.
  useEffect(() => {
    setLinkState(isInvitationLink(window.location.href) ? "valid" : "invalid");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el puerto es estable y se comprueba una vez
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password || !confirm) return setError(copy.form.required);
    if (password !== confirm) return setError(copy.form.errorMismatch);
    accept(
      { email, link: window.location.href, password },
      {
        onSuccess: (session) => router.push(homePath(session)),
        onError: (failure) => {
          // Un enlace caducado o ya usado no se arregla reintentando: se cambia de pantalla.
          if (failure instanceof DomainError && failure.code === "invitation.invalid_link") {
            setLinkState("invalid");
          } else {
            setError(messageFor(failure));
          }
        },
      },
    );
  };

  if (linkState === "checking") {
    return <p className="text-text-muted text-sm">{copy.checking}</p>;
  }

  if (linkState === "invalid") {
    return (
      <div className="w-full max-w-[360px]">
        <div className="bg-surface-raised border-border-subtle rounded-xl border p-8">
          <h1 className="font-display text-display-sm font-bold uppercase">{copy.invalid.title}</h1>
          <p className="text-text-muted mt-2 text-sm">{copy.invalid.description}</p>
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
        <p className="text-text-muted mt-2 text-sm">{copy.subtitle}</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">{copy.form.email}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
            />
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
