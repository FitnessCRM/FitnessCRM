import type { ComponentProps } from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * `<select>` nativo con la flecha dibujada aparte: la del navegador no admite relleno y queda
 * pegada al borde. `className` va al select; el ancho lo da el contenido.
 */
export function NativeSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <span className="relative inline-flex">
      <select
        className={cn(
          "text-text-primary focus-visible:ring-ring/50 appearance-none rounded-md border pr-9 pl-3.5 outline-none focus-visible:ring-[3px]",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon
        aria-hidden
        className="text-text-muted pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
      />
    </span>
  );
}
