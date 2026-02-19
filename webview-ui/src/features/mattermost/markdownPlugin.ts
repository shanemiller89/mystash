import { useMemo } from 'react';
import { useMattermostStore } from './store';
import type { MarkdownRenderPlugin } from '@/components/shared/MarkdownBody';

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * MarkdownBody render plugin that converts :shortcode: patterns
 * into Mattermost custom emoji `<img>` tags.
 *
 * This decouples MarkdownBody from the Mattermost store — only
 * Mattermost consumers wire this plugin in.
 */
function createCustomEmojiPlugin(customEmojis: Record<string, string>): MarkdownRenderPlugin {
    return {
        key: `mattermost-emoji-${Object.keys(customEmojis).length}`,
        transformHtml(html: string): string {
            // Only process remaining :shortcode: that weren't resolved by the
            // built-in Unicode emoji pass in MarkdownBody.
            return html.replace(/:([a-zA-Z0-9_+-]+):/g, (match, name: string) => {
                const customUrl = customEmojis[name];
                if (customUrl) {
                    return `<img src="${escapeHtml(customUrl)}" alt=":${escapeHtml(name)}:" title=":${escapeHtml(name)}:" class="inline-emoji" />`;
                }
                return match;
            });
        },
    };
}

/**
 * React hook that returns an array of MarkdownBody render plugins
 * for Mattermost-specific rendering (custom emoji).
 *
 * Usage:
 * ```tsx
 * const mmPlugins = useMattermostMarkdownPlugins();
 * <MarkdownBody content={msg} renderPlugins={mmPlugins} />
 * ```
 */
export function useMattermostMarkdownPlugins(): MarkdownRenderPlugin[] {
    const customEmojis = useMattermostStore((s) => s.customEmojis);
    return useMemo(
        () => [createCustomEmojiPlugin(customEmojis)],
        [customEmojis],
    );
}
