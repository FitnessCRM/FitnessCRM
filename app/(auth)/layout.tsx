import type { ReactNode } from "react";

/** Pantalla de acceso (01): sin armazón; la propia página monta el panel de marca y el formulario. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="min-h-screen">{children}</main>;
}
