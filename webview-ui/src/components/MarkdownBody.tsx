import React, { useMemo } from 'react';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

// ─── Markdown-it Configuration ────────────────────────────────────

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    breaks: true, // GitHub-style line breaks
    highlight: (str: string, lang: string): string => {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang }).value}</code></pre>`;
            } catch {
                /* fallback */
            }
        }
        return `<pre class="hljs"><code>${escapeHtml(str)}</code></pre>`;
    },
});

// ─── Component ────────────────────────────────────────────────────

interface MarkdownBodyProps {
    content: string;
    className?: string;
}

/**
 * Renders a markdown string as styled HTML.
 * Uses the same markdown-it + highlight.js config as the Notes editor.
 * Wraps output in `.markdown-body` class for consistent styling from index.css.
 */
export const MarkdownBody: React.FC<MarkdownBodyProps> = ({ content, className = '' }) => {
    const html = useMemo(() => md.render(content), [content]);

    return (
        <div
            className={`markdown-body text-[12px] leading-relaxed ${className}`}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
};
