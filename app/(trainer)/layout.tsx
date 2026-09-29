import type { ReactNode } from "react";
import { TrainerShell } from "@/components/trainer/trainer-shell";

export default function TrainerLayout({ children }: { children: ReactNode }) {
  return <TrainerShell>{children}</TrainerShell>;
}
