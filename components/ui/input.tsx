import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-border-emphasis bg-background font-ui text-text-primary selection:bg-accent selection:text-on-accent file:text-text-primary placeholder:text-text-subtle h-12 w-full min-w-0 rounded-md border px-3.5 py-1 text-[15px] transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:border-danger aria-invalid:ring-danger-soft",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
