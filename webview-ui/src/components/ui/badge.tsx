import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
    'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]',
    {
        variants: {
            variant: {
                default:
                    'border-transparent bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]',
                secondary:
                    'border-transparent bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)]',
                destructive:
                    'border-transparent bg-[var(--vscode-errorForeground,#f44747)] text-white',
                outline:
                    'border-[var(--vscode-editorWidget-border,var(--vscode-panel-border))] text-fg',
                success:
                    'border-transparent bg-[var(--vscode-terminal-ansiGreen,#89d185)] text-[#1e1e1e]',
                warning:
                    'border-transparent bg-[var(--vscode-editorWarning-foreground,#cca700)] text-[#1e1e1e]',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    },
);

function Badge({
    className,
    variant,
    ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
    return (
        <span className={cn(badgeVariants({ variant }), className)} {...props} />
    );
}

export { Badge, badgeVariants };
