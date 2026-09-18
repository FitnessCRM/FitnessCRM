import { cn } from "@/lib/utils";

/** Círculo con iniciales, como en la barra lateral y la nav superior de la demo. */
export function InitialsAvatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "bg-border border-border-emphasis font-display grid size-[34px] shrink-0 place-items-center rounded-full border text-sm",
        className,
      )}
    >
      {initials}
    </span>
  );
}
