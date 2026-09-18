import type { ReactNode } from "react";
import { TrainerShell } from "@/components/entrenador/trainer-shell";

export default function TrainerLayout({ children }: { children: ReactNode }) {
  return <TrainerShell>{children}</TrainerShell>;
}
