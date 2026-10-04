import type { ReactNode } from "react";
import { TrainerShell } from "@/components/trainer/trainer-shell";
import { RoleGate } from "@/components/ui/role-gate";

export default function TrainerLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGate area="trainer">
      <TrainerShell>{children}</TrainerShell>
    </RoleGate>
  );
}
