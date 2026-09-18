import type { ReactNode } from "react";
import { Brand } from "@/components/ui/brand";

/** Pantalla de acceso (01): marca arriba a la izquierda, contenido centrado. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col px-14 py-12">
      <Brand />
      <main className="flex flex-1 items-center justify-center">{children}</main>
    </div>
  );
}
