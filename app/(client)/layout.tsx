import type { ReactNode } from "react";
import { ClientShell } from "@/components/cliente/client-shell";

export default function ClientLayout({ children }: { children: ReactNode }) {
  return <ClientShell>{children}</ClientShell>;
}
