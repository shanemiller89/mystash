"use client";

import { cn } from "@/lib/utils";
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cva, type VariantProps } from "class-variance-authority";

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors hover:bg-[var(--vscode-toolbar-hoverBackground)] hover:text-[var(--vscode-foreground)] disabled:pointer-events-none disabled:opacity-50 data-pressed:bg-[var(--vscode-toolbar-activeBackground)] data-pressed:text-[var(--vscode-foreground)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus-visible:border-[var(--vscode-focusBorder)] outline-none",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-[var(--vscode-input-border)] bg-transparent hover:bg-[var(--vscode-toolbar-hoverBackground)] hover:text-[var(--vscode-foreground)]",
      },
      size: {
        default: "h-8 px-3 min-w-8",
        sm: "h-7 px-2 min-w-7",
        lg: "h-10 px-3 min-w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Toggle({
  className,
  variant,
  size,
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
