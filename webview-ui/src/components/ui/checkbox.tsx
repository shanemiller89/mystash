"use client";

import { cn } from "@/lib/utils";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon, MinusIcon } from "lucide-react";

function Checkbox({
  className,
  ...props
}: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-sm border shadow-xs transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--vscode-focusBorder)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-checked:border-[var(--vscode-button-background)] data-checked:bg-[var(--vscode-button-background)] data-checked:text-[var(--vscode-button-foreground)]",
        "data-indeterminate:border-[var(--vscode-button-background)] data-indeterminate:bg-[var(--vscode-button-background)] data-indeterminate:text-[var(--vscode-button-foreground)]",
        "data-unchecked:border-[var(--vscode-input-border,var(--vscode-checkbox-border,#6b7280))] data-unchecked:bg-transparent",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        <CheckIcon className="h-3.5 w-3.5" />
      </CheckboxPrimitive.Indicator>
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indeterminate-indicator"
        className="flex items-center justify-center text-current"
        keepMounted
      >
        <MinusIcon className="h-3.5 w-3.5 hidden data-indeterminate:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
