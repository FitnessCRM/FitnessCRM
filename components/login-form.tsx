"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLogin } from "@/lib/data/hooks";
import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { mutate: login, isPending } = useLogin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Completa todos los campos");
      return;
    }

    try {
      await login(
        { email, password },
        {
          onSuccess: () => {
            router.push("/trainer/dashboard");
          },
          onError: (error) => {
            if (error instanceof Error) {
              setError(
                error.message === "Email no encontrado"
                  ? es.pages.login.form.errorInvalid
                  : es.pages.login.form.errorNetwork,
              );
            } else {
              setError(es.pages.login.form.errorNetwork);
            }
          },
        },
      );
    } catch {
      setError(es.pages.login.form.errorNetwork);
    }
  };

  return (
    <div className="w-full max-w-[360px]">
      <div className="bg-surface-elevated border-border-subtle rounded-xl border p-8">
        <h1 className="font-display text-display-sm font-bold uppercase">{es.pages.login.title}</h1>
        <p className="text-text-secondary mt-2 text-sm">{es.pages.login.subtitle}</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">{es.pages.login.form.email}</Label>
            <Input
              id="email"
              type="email"
              placeholder={es.pages.login.form.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{es.pages.login.form.password}</Label>
            <Input
              id="password"
              type="password"
              placeholder={es.pages.login.form.passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isPending}
            />
          </div>

          {error && <div className="bg-error/14 text-error rounded-lg p-3 text-sm">{error}</div>}

          <Button
            type="submit"
            disabled={isPending}
            className="bg-accent text-text-on-accent hover:bg-accent-hover w-full"
          >
            {isPending ? es.pages.login.form.submitting : es.pages.login.form.submit}
          </Button>
        </form>

        <Link
          href="#"
          className="text-accent-muted hover:text-accent-focus mt-4 block text-center text-sm"
        >
          {es.pages.login.form.forgotPassword}
        </Link>
      </div>
    </div>
  );
}
