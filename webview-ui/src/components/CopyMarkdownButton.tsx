import React, { useState, useCallback } from 'react';
import { Button } from './ui/button';
import { Copy, CopyCheck } from 'lucide-react';

interface CopyMarkdownButtonProps {
    /** The markdown text to copy to clipboard */
    content: string;
    /** Size of the icon */
    iconSize?: number;
    /** Optional label text next to the icon */
    label?: string;
    /** Button variant */
    variant?: 'ghost' | 'outline';
    /** Additional className */
    className?: string;
}

/**
 * A small button that copies markdown content to the clipboard,
 * briefly showing a ✓ checkmark after copying.
 */
export const CopyMarkdownButton: React.FC<CopyMarkdownButtonProps> = ({
    content,
    iconSize = 11,
    label,
    variant = 'ghost',
    className = '',
}) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            if (!content) { return; }
            navigator.clipboard.writeText(content).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
            });
        },
        [content],
    );

    return (
        <Button
            variant={variant}
            size={label ? 'sm' : 'icon-xs'}
            className={`${label ? 'h-auto px-2 py-0.5 gap-1' : ''} ${className}`}
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Copy markdown'}
            disabled={!content}
        >
            {copied ? (
                <CopyCheck size={iconSize} className="text-green-400" />
            ) : (
                <Copy size={iconSize} />
            )}
            {label && (
                <span className={copied ? 'text-green-400' : ''}>
                    {copied ? 'Copied!' : label}
                </span>
            )}
        </Button>
    );
};
