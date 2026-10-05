import type { ReactNode } from "react";
import { ClientShell } from "@/components/client/client-shell";
import { RoleGate } from "@/components/ui/role-gate";

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGate area="client">
      <ClientShell>{children}</ClientShell>
    </RoleGate>
  );
}
