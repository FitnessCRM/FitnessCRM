"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLogout } from "@/lib/data/hooks";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.common.signOut;

/**
 * Cierra la sesión y lleva a `/login`. Terreno neutro: lo usan el panel del entrenador y, cuando
 * llegue, el perfil del cliente. Si el cierre falla se dice aquí mismo y la sesión sigue abierta.
 */
export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const logout = useLogout();

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <button
        type="button"
        disabled={logout.isPending}
        onClick={() => logout.mutate(undefined, { onSuccess: () => router.replace("/login") })}
        // 32 px de alto como todo control pequeño (también en táctil).
        className="text-text-muted hover:text-text-primary flex min-h-8 w-full items-center gap-2 rounded-sm text-sm transition-colors disabled:opacity-60"
      >
        <LogOutIcon aria-hidden className="size-4" />
        {logout.isPending ? t.pending : t.action}
      </button>
      {logout.isError ? (
        <p role="alert" className="text-danger text-xs">
          {t.failed}
        </p>
      ) : null}
    </div>
  );
}
