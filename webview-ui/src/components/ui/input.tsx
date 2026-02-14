import * as React from 'react';

import { cn } from '@/lib/utils';

function Input({
    className,
    type = 'text',
    ...props
}: React.ComponentProps<'input'>) {
    return (
        <input
            type={type}
            className={cn(
                'flex h-8 w-full rounded-md border px-3 py-1.5 text-sm shadow-xs transition-colors',
                'border-[var(--vscode-input-border,transparent)] bg-[var(--vscode-input-background)]',
                'text-[var(--vscode-input-foreground)] placeholder:text-fg/40',
                'focus-visible:outline-none focus-visible:border-[var(--vscode-focusBorder)] focus-visible:ring-1 focus-visible:ring-[var(--vscode-focusBorder)]',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'file:border-0 file:bg-transparent file:text-sm file:font-medium',
                className,
            )}
            {...props}
        />
    );
}

export { Input };
