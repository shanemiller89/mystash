import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const avatarVariants = cva(
    'relative flex shrink-0 overflow-hidden rounded-full bg-[var(--vscode-button-secondaryBackground)]',
    {
        variants: {
            size: {
                default: 'h-8 w-8',
                sm: 'h-6 w-6',
                lg: 'h-10 w-10',
                xl: 'h-12 w-12',
            },
        },
        defaultVariants: {
            size: 'default',
        },
    },
);

function Avatar({
    className,
    size,
    ...props
}: React.ComponentProps<'span'> & VariantProps<typeof avatarVariants>) {
    return (
        <span
            className={cn(avatarVariants({ size }), className)}
            {...props}
        />
    );
}

function AvatarImage({
    className,
    alt = '',
    ...props
}: React.ComponentProps<'img'>) {
    return (
        <img
            className={cn('aspect-square h-full w-full object-cover', className)}
            alt={alt}
            {...props}
        />
    );
}

function AvatarFallback({
    className,
    ...props
}: React.ComponentProps<'span'>) {
    return (
        <span
            className={cn(
                'flex h-full w-full items-center justify-center rounded-full bg-[var(--vscode-button-secondaryBackground)] text-xs font-medium text-fg/70',
                className,
            )}
            {...props}
        />
    );
}

export { Avatar, AvatarImage, AvatarFallback };
