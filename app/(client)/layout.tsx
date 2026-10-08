import type { ReactNode } from "react";
import { ClientAccessGate } from "@/components/client/client-access-gate";
import { ClientShell } from "@/components/client/client-shell";
import { RoleGate } from "@/components/ui/role-gate";

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGate area="client">
      <ClientAccessGate>
        <ClientShell>{children}</ClientShell>
      </ClientAccessGate>
    </RoleGate>
  );
}
