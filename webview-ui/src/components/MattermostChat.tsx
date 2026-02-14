import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useMattermostStore, type MattermostPostData } from '../mattermostStore';
import { postMessage } from '../vscode';
import { MarkdownBody } from './MarkdownBody';
import {
    Send,
    ArrowLeft,
    RefreshCw,
    ChevronUp,
    Copy,
    Check,
} from 'lucide-react';

function formatTime(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const timeStr = date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
    });

    if (diffDays === 0) { return timeStr; }
    if (diffDays === 1) { return `Yesterday ${timeStr}`; }
    if (diffDays < 7) { return `${date.toLocaleDateString(undefined, { weekday: 'short' })} ${timeStr}`; }
    return `${date.toLocaleDateString()} ${timeStr}`;
}

/** Group posts by date for visual separation */
function groupPostsByDate(posts: MattermostPostData[]): { date: string; posts: MattermostPostData[] }[] {
    const groups: { date: string; posts: MattermostPostData[] }[] = [];
    let currentDate = '';

    // Posts come newest-first, we want to display oldest-first
    const chronological = [...posts].reverse();

    for (const post of chronological) {
        const postDate = new Date(post.createAt).toLocaleDateString();
        if (postDate !== currentDate) {
            currentDate = postDate;
            groups.push({ date: postDate, posts: [] });
        }
        groups[groups.length - 1].posts.push(post);
    }

    return groups;
}

/** Individual message bubble */
const MessageBubble: React.FC<{
    post: MattermostPostData;
    currentUsername: string | null;
}> = ({ post, currentUsername }) => {
    const [copied, setCopied] = useState(false);
    const isOwn = currentUsername !== null && post.username === currentUsername;

    const handleCopy = useCallback(() => {
        void navigator.clipboard.writeText(post.message);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }, [post.message]);

    // Skip system messages
    if (post.type && post.type !== '') {
        return (
            <div className="text-center text-xs text-fg/40 py-1 px-4">
                {post.message}
            </div>
        );
    }

    return (
        <div className={`group flex gap-2 px-3 py-1.5 hover:bg-[var(--vscode-list-hoverBackground)] ${isOwn ? 'flex-row-reverse' : ''}`}>
            {/* Avatar placeholder */}
            <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isOwn
                        ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]'
                        : 'bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]'
                }`}
            >
                {post.username.charAt(0).toUpperCase()}
            </div>

            <div className={`flex-1 min-w-0 ${isOwn ? 'text-right' : ''}`}>
                <div className={`flex items-baseline gap-2 ${isOwn ? 'justify-end' : ''}`}>
                    <span className="text-xs font-semibold text-[var(--vscode-textLink-foreground)]">
                        {post.username}
                    </span>
                    <span className="text-xs text-fg/40">{formatTime(post.createAt)}</span>
                    <button
                        onClick={handleCopy}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--vscode-toolbar-hoverBackground)] text-fg/40 transition-opacity"
                        title="Copy message"
                    >
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                </div>
                <div className={`text-sm mt-0.5 ${isOwn ? 'text-right' : ''}`}>
                    <MarkdownBody content={post.message} />
                </div>
            </div>
        </div>
    );
};

export const MattermostChat: React.FC<{
    onClose: () => void;
}> = ({ onClose }) => {
    const selectedChannelId = useMattermostStore((s) => s.selectedChannelId);
    const selectedChannelName = useMattermostStore((s) => s.selectedChannelName);
    const posts = useMattermostStore((s) => s.posts);
    const isLoadingPosts = useMattermostStore((s) => s.isLoadingPosts);
    const isSendingMessage = useMattermostStore((s) => s.isSendingMessage);
    const hasMorePosts = useMattermostStore((s) => s.hasMorePosts);
    const currentUser = useMattermostStore((s) => s.currentUser);

    const [messageText, setMessageText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const currentUsername = useMemo(
        () => currentUser?.username ?? null,
        [currentUser],
    );

    const dateGroups = useMemo(() => groupPostsByDate(posts), [posts]);

    // Auto-scroll to bottom when new posts arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [posts]);

    const handleSend = useCallback(() => {
        const text = messageText.trim();
        if (!text || !selectedChannelId) { return; }
        postMessage('mattermost.sendPost', {
            channelId: selectedChannelId,
            message: text,
        });
        setMessageText('');
    }, [messageText, selectedChannelId]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSend();
            }
        },
        [handleSend],
    );

    const handleLoadMore = useCallback(() => {
        if (!selectedChannelId || isLoadingPosts) { return; }
        const page = Math.ceil(posts.length / 30);
        postMessage('mattermost.getPosts', {
            channelId: selectedChannelId,
            page,
        });
    }, [selectedChannelId, isLoadingPosts, posts.length]);

    const handleRefresh = useCallback(() => {
        if (!selectedChannelId) { return; }
        postMessage('mattermost.getPosts', { channelId: selectedChannelId });
    }, [selectedChannelId]);

    if (!selectedChannelId) {
        return (
            <div className="flex items-center justify-center h-full text-sm text-fg/50">
                Select a channel to start chatting
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--vscode-panel-border)] shrink-0">
                <button
                    onClick={onClose}
                    className="p-1 rounded hover:bg-[var(--vscode-toolbar-hoverBackground)] text-fg/60 md:hidden"
                    title="Back to channels"
                >
                    <ArrowLeft size={16} />
                </button>
                <span className="text-sm font-semibold truncate flex-1">
                    # {selectedChannelName}
                </span>
                <button
                    onClick={handleRefresh}
                    className="p-1 rounded hover:bg-[var(--vscode-toolbar-hoverBackground)] text-fg/60"
                    title="Refresh"
                >
                    <RefreshCw size={14} className={isLoadingPosts ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto py-2">
                {/* Load more */}
                {hasMorePosts && posts.length > 0 && (
                    <div className="text-center py-2">
                        <button
                            onClick={handleLoadMore}
                            disabled={isLoadingPosts}
                            className="text-xs text-[var(--vscode-textLink-foreground)] hover:underline inline-flex items-center gap-1"
                        >
                            <ChevronUp size={12} />
                            {isLoadingPosts ? 'Loading…' : 'Load older messages'}
                        </button>
                    </div>
                )}

                {isLoadingPosts && posts.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-sm text-fg/50">
                        Loading messages…
                    </div>
                ) : posts.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-sm text-fg/50">
                        No messages yet. Start the conversation!
                    </div>
                ) : (
                    dateGroups.map((group) => (
                        <div key={group.date}>
                            {/* Date separator */}
                            <div className="flex items-center gap-2 px-3 py-2">
                                <div className="flex-1 h-px bg-[var(--vscode-panel-border)]" />
                                <span className="text-xs text-fg/40 whitespace-nowrap">
                                    {group.date}
                                </span>
                                <div className="flex-1 h-px bg-[var(--vscode-panel-border)]" />
                            </div>
                            {group.posts.map((post) => (
                                <MessageBubble
                                    key={post.id}
                                    post={post}
                                    currentUsername={currentUsername}
                                />
                            ))}
                        </div>
                    ))
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Compose area */}
            <div className="shrink-0 border-t border-[var(--vscode-panel-border)] p-3">
                <div className="flex gap-2">
                    <textarea
                        ref={textareaRef}
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message… (⌘+Enter to send)"
                        rows={2}
                        className="flex-1 px-3 py-2 text-sm rounded-md resize-none
                            bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)]
                            border border-[var(--vscode-input-border)]
                            focus:outline-none focus:border-[var(--vscode-focusBorder)]
                            placeholder:text-fg/40"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!messageText.trim() || isSendingMessage}
                        className="self-end p-2 rounded-md bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Send message (⌘+Enter)"
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};
