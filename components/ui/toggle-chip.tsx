import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Opción de un grupo de radio con aspecto de botón; 40 px de alto para el táctil. */
export function ToggleChip({
  checked,
  tone = "accent",
  onClick,
  children,
}: {
  checked: boolean;
  tone?: "accent" | "success" | "danger";
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className={cn(
        "focus-visible:ring-ring/50 h-10 rounded-md border px-3.5 text-[13px] transition-colors outline-none focus-visible:ring-[3px]",
        !checked && "border-border-emphasis text-text-muted hover:text-text-primary",
        checked && tone === "accent" && "border-accent bg-accent text-on-accent font-semibold",
        checked &&
          tone === "success" &&
          "border-success/35 bg-success-soft text-success font-semibold",
        checked && tone === "danger" && "border-danger/35 bg-danger-soft text-danger font-semibold",
      )}
    >
      {children}
    </button>
  );
}
