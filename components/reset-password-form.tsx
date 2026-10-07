"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCheckPasswordResetCode, useConfirmPasswordReset } from "@/lib/data/hooks";
import { DomainError } from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const copy = es.pages.resetPassword;

/** Longitud mínima de contraseña de Firebase: se avisa antes de gastar el código, que es de un solo uso. */
const MIN_PASSWORD_LENGTH = 6;

/**
 * El código del enlace del correo, o `""` si la dirección no es un enlace de recuperación. Lleva
 * `mode=resetPassword` y `oobCode`; un `mode` distinto es otro correo de Firebase, no este.
 */
function codeFromLocation(): string {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const code = params.get("oobCode") ?? "";
  return mode !== null && mode !== "resetPassword" ? "" : code;
}

function messageFor(error: unknown): string {
  if (error instanceof DomainError && error.code === "password_reset.weak_password") {
    return copy.form.errorWeak;
  }
  return copy.form.errorNetwork;
}

function InvalidLink() {
  return (
    <div className="w-full max-w-[360px]">
      <div className="bg-surface-raised border-border-subtle rounded-xl border p-8">
        <h1 className="font-display text-display-sm font-bold uppercase">{copy.invalid.title}</h1>
        <p className="text-text-muted mt-2 text-sm">{copy.invalid.description}</p>
        <Link
          href="/forgot-password"
          className="text-accent hover:text-accent-hover mt-6 flex min-h-8 items-center text-sm"
        >
          {copy.invalid.requestNew}
        </Link>
        <Link
          href="/login"
          className="text-text-muted hover:text-text-primary flex min-h-8 items-center text-sm"
        >
          {copy.invalid.toLogin}
        </Link>
      </div>
    </div>
  );
}

/**
 * Fija la contraseña nueva con el enlace del correo. Al guardar no abre sesión: vuelve al acceso
 * con un aviso y se entra con la nueva, como siempre.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  // `null` hasta leer la dirección, que solo existe en el navegador.
  const [code, setCode] = useState<string | null>(null);
  const check = useCheckPasswordResetCode(code);
  const { mutate: confirm, isPending } = useConfirmPasswordReset();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [spent, setSpent] = useState(false);

  useEffect(() => {
    setCode(codeFromLocation());
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password || !repeat) return setError(copy.form.required);
    if (password !== repeat) return setError(copy.form.errorMismatch);
    if (password.length < MIN_PASSWORD_LENGTH) return setError(copy.form.errorWeak);
    confirm(
      { code: code ?? "", password },
      {
        onSuccess: () => router.push("/login?reset=1"),
        onError: (failure) => {
          // Un enlace caducado o ya usado no se arregla reintentando: se cambia de pantalla.
          if (failure instanceof DomainError && failure.code === "password_reset.invalid_link") {
            setSpent(true);
          } else {
            setError(messageFor(failure));
          }
        },
      },
    );
  };

  if (code === null || (code !== "" && check.isPending)) {
    return <p className="text-text-muted text-sm">{copy.checking}</p>;
  }
  if (code === "" || spent) return <InvalidLink />;
  if (check.isError) {
    if (check.error instanceof DomainError && check.error.code === "password_reset.invalid_link") {
      return <InvalidLink />;
    }
    return (
      <div className="w-full max-w-[360px]">
        <div role="alert" className="bg-danger-soft text-danger rounded-lg p-3 text-sm">
          {copy.form.errorNetwork}
        </div>
        <Button variant="outline" className="mt-4" onClick={() => void check.refetch()}>
          {copy.form.retry}
        </Button>
      </div>
    );
  }

  const email = check.data?.email ?? "";
  return (
    <div className="w-full max-w-[360px]">
      <div className="bg-surface-raised border-border-subtle rounded-xl border p-8">
        <h1 className="font-display text-display-sm font-bold uppercase">{copy.title}</h1>
        <p className="text-text-muted mt-2 text-sm">{copy.subtitle.replace("{email}", email)}</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          {/* Para que el gestor de contraseñas sepa a qué cuenta pertenece la nueva. */}
          <input
            type="email"
            autoComplete="username"
            value={email}
            readOnly
            tabIndex={-1}
            aria-hidden
            className="sr-only"
          />

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
            <Label htmlFor="repeat">{copy.form.confirm}</Label>
            <Input
              id="repeat"
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
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
