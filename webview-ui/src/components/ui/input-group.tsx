import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/*  InputGroup                                                                 */
/* -------------------------------------------------------------------------- */

function InputGroup({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="input-group"
            role="group"
            className={cn(
                'group/input-group relative flex w-full min-w-0 items-center rounded-md border outline-none',
                'border-[var(--vscode-input-border,transparent)] bg-[var(--vscode-input-background)]',
                'transition-[color,box-shadow]',
                'h-9 has-[>textarea]:h-auto',
                // Variants based on addon alignment
                'has-[>[data-align=inline-start]]:[&>input]:pl-2',
                'has-[>[data-align=inline-end]]:[&>input]:pr-2',
                'has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3',
                'has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3',
                // Focus state
                'has-[[data-slot=input-group-control]:focus-visible]:border-[var(--vscode-focusBorder)]',
                'has-[[data-slot=input-group-control]:focus-visible]:ring-[1px] has-[[data-slot=input-group-control]:focus-visible]:ring-[var(--vscode-focusBorder)]',
                className,
            )}
            {...props}
        />
    );
}

/* -------------------------------------------------------------------------- */
/*  InputGroupAddon                                                            */
/* -------------------------------------------------------------------------- */

const inputGroupAddonVariants = cva(
    'text-fg/60 flex h-auto cursor-text items-center gap-2 py-1.5 text-sm font-medium select-none [&>svg:not([class*=size-])]:size-4 group-data-[disabled=true]/input-group:opacity-50',
    {
        variants: {
            align: {
                'inline-start':
                    'justify-center order-first pl-3 has-[>button]:ml-[-0.45rem]',
                'inline-end':
                    'justify-center order-last pr-3 has-[>button]:mr-[-0.45rem]',
                'block-start':
                    'order-first w-full justify-start px-3 pt-2 group-has-[>input]/input-group:pt-2.5',
                'block-end':
                    'order-last w-full justify-start px-3 pb-2 group-has-[>input]/input-group:pb-2.5',
            },
        },
        defaultVariants: {
            align: 'inline-start',
        },
    },
);

function InputGroupAddon({
    className,
    align = 'inline-start',
    ...props
}: React.ComponentProps<'div'> & VariantProps<typeof inputGroupAddonVariants>) {
    return (
        <div
            role="group"
            data-slot="input-group-addon"
            data-align={align}
            className={cn(inputGroupAddonVariants({ align }), className)}
            onClick={(e) => {
                if ((e.target as HTMLElement).closest('button')) {
                    return;
                }
                // Focus the textarea or input inside the parent group
                const parent = e.currentTarget.parentElement;
                const control =
                    parent?.querySelector('textarea') ??
                    parent?.querySelector('input');
                control?.focus();
            }}
            {...props}
        />
    );
}

/* -------------------------------------------------------------------------- */
/*  InputGroupButton                                                           */
/* -------------------------------------------------------------------------- */

const inputGroupButtonVariants = cva(
    'inline-flex items-center justify-center gap-2 text-sm font-medium shadow-none transition-colors',
    {
        variants: {
            size: {
                xs: 'h-6 gap-1 px-2 rounded-[5px] [&>svg:not([class*=size-])]:size-3.5 has-[>svg]:px-2',
                sm: 'h-8 px-2.5 gap-1.5 rounded-md has-[>svg]:px-2.5',
                'icon-xs': 'size-6 rounded-[5px] p-0 has-[>svg]:p-0',
                'icon-sm': 'size-8 p-0 has-[>svg]:p-0',
            },
            variant: {
                ghost: 'hover:bg-[var(--vscode-toolbar-hoverBackground)] text-fg/60 hover:text-fg',
                outline:
                    'border border-[var(--vscode-input-border,transparent)] hover:bg-[var(--vscode-toolbar-hoverBackground)] text-fg/60 hover:text-fg',
                default:
                    'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]',
            },
        },
        defaultVariants: {
            size: 'xs',
            variant: 'ghost',
        },
    },
);

function InputGroupButton({
    className,
    type = 'button',
    variant = 'ghost',
    size = 'xs',
    ...props
}: React.ComponentProps<'button'> &
    VariantProps<typeof inputGroupButtonVariants>) {
    return (
        <button
            type={type}
            data-size={size}
            className={cn(
                inputGroupButtonVariants({ size, variant }),
                'disabled:opacity-40 disabled:cursor-not-allowed',
                className,
            )}
            {...props}
        />
    );
}

/* -------------------------------------------------------------------------- */
/*  InputGroupText                                                             */
/* -------------------------------------------------------------------------- */

function InputGroupText({
    className,
    ...props
}: React.ComponentProps<'span'>) {
    return (
        <span
            className={cn(
                'text-fg/50 flex items-center gap-2 text-sm [&_svg]:pointer-events-none [&_svg:not([class*=size-])]:size-4',
                className,
            )}
            {...props}
        />
    );
}

/* -------------------------------------------------------------------------- */
/*  InputGroupInput                                                            */
/* -------------------------------------------------------------------------- */

function InputGroupInput({
    className,
    ...props
}: React.ComponentProps<'input'>) {
    return (
        <input
            data-slot="input-group-control"
            className={cn(
                'flex-1 rounded-none border-0 bg-transparent px-3 py-2 text-sm shadow-none outline-none',
                'text-[var(--vscode-input-foreground)] placeholder:text-fg/40',
                'focus-visible:ring-0',
                className,
            )}
            {...props}
        />
    );
}

/* -------------------------------------------------------------------------- */
/*  InputGroupTextarea                                                         */
/* -------------------------------------------------------------------------- */

function InputGroupTextarea({
    className,
    ...props
}: React.ComponentProps<'textarea'>) {
    return (
        <textarea
            data-slot="input-group-control"
            className={cn(
                'w-full flex-1 resize-none rounded-none border-0 bg-transparent px-3 py-2.5 text-sm shadow-none outline-none',
                'text-[var(--vscode-input-foreground)] placeholder:text-fg/40',
                'focus-visible:ring-0',
                className,
            )}
            {...props}
        />
    );
}

export {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupText,
    InputGroupInput,
    InputGroupTextarea,
};
