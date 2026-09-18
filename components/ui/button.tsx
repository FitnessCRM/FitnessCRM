import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Slot } from "radix-ui";

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md font-display text-sm font-semibold tracking-label uppercase whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-danger-soft [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-accent text-on-accent hover:bg-accent-hover",
        destructive: "bg-danger-soft text-danger border border-danger/55 hover:bg-danger/25",
        outline:
          "border border-border-emphasis bg-transparent text-text-muted hover:border-accent hover:text-accent-emphasis",
        /* Secundarios de la demo (Editar, Eliminar, Cancelar): Inter 13px, sin mayúsculas. */
        secondary:
          "border border-border-emphasis bg-transparent font-ui text-sm font-normal normal-case tracking-normal text-text-muted hover:border-border-strong hover:bg-surface-overlay hover:text-text-primary",
        ghost:
          "font-ui text-sm font-normal normal-case tracking-normal text-text-muted hover:bg-surface-overlay hover:text-text-primary",
        link: "font-ui normal-case tracking-normal text-accent-hover underline-offset-4 hover:text-accent-emphasis hover:underline",
        pill: "rounded-full border border-border-emphasis bg-transparent font-ui text-xs font-normal text-text-muted hover:border-accent hover:text-text-primary",
      },
      size: {
        default: "h-11 px-[22px] text-[14px] has-[>svg]:px-4",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3.5 text-[12px] has-[>svg]:px-3",
        lg: "h-12 rounded-md px-6 text-[16px] tracking-wide has-[>svg]:px-5",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
