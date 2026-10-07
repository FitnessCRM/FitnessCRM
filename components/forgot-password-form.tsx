"use client";

import { useState } from "react";
import Link from "next/link";
import { useSendPasswordReset } from "@/lib/data/hooks";
import { DomainError } from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const copy = es.pages.forgotPassword;

/** Qué dice el formulario de cada fallo del puerto; lo que no conoce es un fallo de conexión. */
function messageFor(error: unknown): string {
  if (error instanceof DomainError && error.code === "password_reset.invalid_email") {
    return copy.form.errorEmail;
  }
  return copy.form.errorNetwork;
}

/**
 * Pide el enlace de recuperación. Tras enviar dice siempre lo mismo, exista o no una cuenta con ese
 * correo (§12), y recuerda al cliente invitado que lo suyo es su invitación.
 */
export function ForgotPasswordForm() {
  const { mutate: send, isPending } = useSendPasswordReset();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return setError(copy.form.required);
    send(email, {
      onSuccess: () => setSent(true),
      onError: (failure) => setError(messageFor(failure)),
    });
  };

  if (sent) {
    return (
      <div className="w-full max-w-[360px]">
        <div className="bg-surface-raised border-border-subtle rounded-xl border p-8">
          <h1 className="font-display text-display-sm font-bold uppercase">{copy.sent.title}</h1>
          <p role="status" className="text-text-muted mt-2 text-sm">
            {copy.sent.description}
          </p>
          <p className="text-text-subtle mt-4 text-sm">{copy.sent.invitedHint}</p>
          <Link
            href="/login"
            className="text-accent hover:text-accent-hover mt-6 flex min-h-8 items-center text-sm"
          >
            {copy.sent.toLogin}
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

        <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">{copy.form.email}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={copy.form.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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

        <Link
          href="/login"
          className="text-accent hover:text-accent-hover mt-4 flex min-h-8 items-center justify-center text-sm"
        >
          {copy.form.back}
        </Link>
      </div>
    </div>
  );
}
