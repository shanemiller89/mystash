import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--vscode-focusBorder)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*=size-])]:size-4 [&_svg]:shrink-0',
    {
        variants: {
            variant: {
                default:
                    'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]',
                secondary:
                    'bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]',
                destructive:
                    'bg-[var(--vscode-errorForeground,#f44747)] text-white hover:opacity-90',
                outline:
                    'border border-[var(--vscode-input-border,transparent)] bg-transparent text-fg hover:bg-[var(--vscode-toolbar-hoverBackground)]',
                ghost:
                    'text-fg/60 hover:bg-[var(--vscode-toolbar-hoverBackground)] hover:text-fg',
                link:
                    'text-[var(--vscode-textLink-foreground)] underline-offset-4 hover:underline',
            },
            size: {
                default: 'h-8 px-3 py-1.5',
                sm: 'h-7 rounded-md px-2.5 text-xs',
                lg: 'h-9 rounded-md px-4',
                icon: 'h-8 w-8',
                'icon-sm': 'h-7 w-7',
                'icon-xs': 'h-6 w-6',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
);

function Button({
    className,
    variant,
    size,
    ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
    return (
        <button
            className={cn(buttonVariants({ variant, size }), className)}
            {...props}
        />
    );
}

export { Button, buttonVariants };
