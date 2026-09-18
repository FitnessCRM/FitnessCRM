import { APP_NAME } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

/** Logo de la demo: marca roja en `clip-path` + nombre en Oswald. El nombre sale de APP_NAME. */
export function Brand({ tag, className }: { tag?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="bg-accent size-6 shrink-0"
        style={{ clipPath: "polygon(0 100%, 40% 0, 60% 55%, 100% 0, 78% 100%)" }}
      />
      <span className="font-display text-lg font-bold tracking-wide">
        {APP_NAME}
        {tag ? (
          <span className="text-text-subtle ml-1.5 text-xs font-normal tracking-[1px] uppercase">
            {tag}
          </span>
        ) : null}
      </span>
    </div>
  );
}
