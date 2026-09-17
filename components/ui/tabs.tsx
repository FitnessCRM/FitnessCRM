"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Tabs as TabsPrimitive } from "radix-ui";

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn("group/tabs flex gap-4 data-[orientation=horizontal]:flex-col", className)}
      {...props}
    />
  );
}

/**
 * Two looks from the demo:
 * - `underline` (default): Oswald uppercase tabs with a 3px accent underline (Rutina / Menú in the editor).
 * - `segmented`: compact pill group on a dark surface (Día de entrenamiento / Día de descanso).
 */
const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center text-text-muted group-data-[orientation=vertical]/tabs:flex-col",
  {
    variants: {
      variant: {
        underline: "gap-1 border-b border-border-subtle",
        segmented: "gap-1 rounded-md bg-surface p-1",
      },
    },
    defaultVariants: {
      variant: "underline",
    },
  },
);

function TabsList({
  className,
  variant = "underline",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "text-text-muted hover:text-text-primary focus-visible:ring-ring/50 data-[state=active]:text-text-primary relative inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap uppercase transition-colors outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // underline
        "group-data-[variant=underline]/tabs-list:font-display group-data-[variant=underline]/tabs-list:tracking-label group-data-[variant=underline]/tabs-list:px-5 group-data-[variant=underline]/tabs-list:py-2.5 group-data-[variant=underline]/tabs-list:text-[15px]",
        "group-data-[variant=underline]/tabs-list:after:bg-accent group-data-[variant=underline]/tabs-list:after:absolute group-data-[variant=underline]/tabs-list:after:inset-x-0 group-data-[variant=underline]/tabs-list:after:bottom-[-1px] group-data-[variant=underline]/tabs-list:after:h-[3px] group-data-[variant=underline]/tabs-list:after:opacity-0 group-data-[variant=underline]/tabs-list:after:transition-opacity group-data-[variant=underline]/tabs-list:data-[state=active]:after:opacity-100",
        // segmented
        "group-data-[variant=segmented]/tabs-list:font-display group-data-[variant=segmented]/tabs-list:data-[state=active]:bg-border-strong group-data-[variant=segmented]/tabs-list:rounded-sm group-data-[variant=segmented]/tabs-list:px-3.5 group-data-[variant=segmented]/tabs-list:py-2 group-data-[variant=segmented]/tabs-list:text-[13px] group-data-[variant=segmented]/tabs-list:tracking-[1px]",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
