import React, { useMemo } from 'react';
import { useMattermostStore, type MattermostReactionData } from '../mattermostStore';
import { postMessage } from '../vscode';

/** Compact reaction bar under a message — shared between Chat and ThreadPanel */
export const ReactionBar: React.FC<{ postId: string; currentUserId: string | null }> = ({ postId, currentUserId }) => {
    const reactions = useMattermostStore((s) => s.reactions[postId]);
    if (!reactions || reactions.length === 0) { return null; }

    // Group by emoji
    const grouped = useMemo(() => {
        const map = new Map<string, MattermostReactionData[]>();
        for (const r of reactions) {
            const list = map.get(r.emojiName) ?? [];
            list.push(r);
            map.set(r.emojiName, list);
        }
        return Array.from(map.entries());
    }, [reactions]);

    return (
        <div className="flex flex-wrap gap-1 mt-1">
            {grouped.map(([emoji, users]) => {
                const myReaction = users.some((u) => u.userId === currentUserId);
                return (
                    <button
                        key={emoji}
                        onClick={() => {
                            if (myReaction) {
                                postMessage('mattermost.removeReaction', { postId, emojiName: emoji });
                            } else {
                                postMessage('mattermost.addReaction', { postId, emojiName: emoji });
                            }
                        }}
                        title={users.map((u) => u.username).join(', ')}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] border transition-colors ${
                            myReaction
                                ? 'border-[var(--vscode-textLink-foreground)] bg-[var(--vscode-textLink-foreground)]/10 text-[var(--vscode-textLink-foreground)]'
                                : 'border-[var(--vscode-panel-border)] text-fg/60 hover:bg-[var(--vscode-list-hoverBackground)]'
                        }`}
                    >
                        <span>:{emoji}:</span>
                        <span className="font-medium">{users.length}</span>
                    </button>
                );
            })}
        </div>
    );
};
