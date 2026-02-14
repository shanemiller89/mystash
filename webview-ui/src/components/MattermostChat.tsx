import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useMattermostStore, type MattermostPostData } from '../mattermostStore';
import { postMessage } from '../vscode';
import { EmojiPickerButton, ComposeEmojiPickerButton } from './EmojiPicker';
import { useEmojiAutocomplete, EmojiAutocompleteDropdown } from './useEmojiAutocomplete';
import { MarkdownBody } from './MarkdownBody';
import { ReactionBar } from './ReactionBar';
import { FileAttachments } from './FileAttachments';
import {
    InputGroup,
    InputGroupTextarea,
    InputGroupAddon,
    InputGroupButton,
} from './ui/input-group';
import { Button } from './ui/button';
import {
    Send,
    ArrowLeft,
    RefreshCw,
    ChevronUp,
    ChevronDown,
    ChevronRight,
    Copy,
    Check,
    MessageSquare,
    WifiOff,
    Circle,
    X,
    Smile,
    ExternalLink,
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

/** Small coloured status dot for message avatars */
function StatusDot({ userId }: { userId: string }) {
    const status = useMattermostStore((s) => s.userStatuses[userId]);
    const color = (() => {
        switch (status) {
            case 'online':  return '#22c55e';
            case 'away':    return '#f59e0b';
            case 'dnd':     return '#ef4444';
            default:        return undefined;
        }
    })();
    if (!color) { return null; }
    return (
        <span
            className="absolute bottom-px right-px w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: color, boxShadow: '0 0 0 1.5px var(--vscode-editor-background)' }}
        />
    );
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
    currentUserId: string | null;
    onOpenThread: (rootId: string) => void;
    isThreadReply?: boolean;
}> = ({ post, currentUsername, currentUserId, onOpenThread, isThreadReply }) => {
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

    // Reply detection (used for styling inline thread replies)
    const isReply = post.rootId && post.rootId !== '';

    return (
        <div className={`group flex gap-2 px-3 py-1.5 hover:bg-[var(--vscode-list-hoverBackground)] ${isThreadReply ? 'ml-8 border-l-2 border-[var(--vscode-panel-border)] pl-2' : ''}`}>
            {/* Avatar with status dot */}
            <div className="relative shrink-0 w-8 h-8">
                <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        isOwn
                            ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]'
                            : 'bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]'
                    }`}
                >
                    {post.username.charAt(0).toUpperCase()}
                </div>
                <StatusDot userId={post.userId} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--vscode-textLink-foreground)]">
                        {post.username}
                    </span>
                    <span className="text-xs text-fg/40">{formatTime(post.createAt)}</span>

                    {/* Action buttons — visible on hover */}
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={handleCopy}
                            title="Copy message"
                        >
                            {copied ? <Check size={12} /> : <Copy size={12} />}
                        </Button>
                        <EmojiPickerButton postId={post.id} />
                        {!isReply && (
                            <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => onOpenThread(post.id)}
                                title="Reply in thread"
                            >
                                <MessageSquare size={12} />
                            </Button>
                        )}
                    </div>
                </div>

                <div className="text-sm mt-0.5">
                    <MarkdownBody content={post.message} />
                </div>

                {/* File attachments */}
                <FileAttachments files={post.files} />

                {/* Reaction bar */}
                <ReactionBar postId={post.id} currentUserId={currentUserId} />


            </div>
        </div>
    );
};

/** Typing indicator (Slack-style) */
const TypingIndicator: React.FC<{ channelId: string }> = ({ channelId }) => {
    const typingEntries = useMattermostStore((s) => s.typingEntries);
    const currentUser = useMattermostStore((s) => s.currentUser);
    const clearStaleTyping = useMattermostStore((s) => s.clearStaleTyping);

    // Clear stale entries every second
    useEffect(() => {
        const timer = setInterval(clearStaleTyping, 1000);
        return () => clearInterval(timer);
    }, [clearStaleTyping]);

    const typingUsers = useMemo(() => {
        return typingEntries
            .filter((e) => e.channelId === channelId && e.userId !== currentUser?.id)
            .map((e) => e.userId);
    }, [typingEntries, channelId, currentUser]);

    if (typingUsers.length === 0) { return null; }

    return (
        <div className="px-3 py-1 text-xs text-fg/50 flex items-center gap-1.5">
            <span className="flex gap-0.5">
                <span className="w-1.5 h-1.5 bg-fg/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-fg/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-fg/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            {typingUsers.length === 1
                ? 'Someone is typing…'
                : `${typingUsers.length} people are typing…`}
        </div>
    );
};

/** Reconnecting banner */
const ConnectionBanner: React.FC = () => {
    const isConnected = useMattermostStore((s) => s.isConnected);
    const isConfigured = useMattermostStore((s) => s.isConfigured);
    if (isConnected || !isConfigured) { return null; }
    return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border-b border-yellow-500/30 text-yellow-600 dark:text-yellow-400 text-xs">
            <WifiOff size={12} />
            Reconnecting…
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
    const openThread = useMattermostStore((s) => s.openThread);
    const replyToPostId = useMattermostStore((s) => s.replyToPostId);
    const replyToUsername = useMattermostStore((s) => s.replyToUsername);
    const setReplyTo = useMattermostStore((s) => s.setReplyTo);
    const clearReplyTo = useMattermostStore((s) => s.clearReplyTo);

    const [messageText, setMessageText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const currentUsername = useMemo(
        () => currentUser?.username ?? null,
        [currentUser],
    );
    const currentUserId = useMemo(
        () => currentUser?.id ?? null,
        [currentUser],
    );

    const dateGroups = useMemo(() => groupPostsByDate(posts), [posts]);

    // Track which threads are expanded (default = all collapsed)
    const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

    const toggleThread = useCallback((rootId: string) => {
        setExpandedThreads((prev) => {
            const next = new Set(prev);
            if (next.has(rootId)) {
                next.delete(rootId);
            } else {
                next.add(rootId);
            }
            return next;
        });
    }, []);

    // Group posts: root posts in order, with their inline replies collected
    const threadedGroups = useMemo(() => {
        return dateGroups.map((group) => {
            const rootPosts: { root: MattermostPostData; replies: MattermostPostData[] }[] = [];
            const replyMap = new Map<string, MattermostPostData[]>();

            // First pass: collect replies by rootId
            for (const post of group.posts) {
                if (post.rootId && post.rootId !== '') {
                    const existing = replyMap.get(post.rootId) ?? [];
                    existing.push(post);
                    replyMap.set(post.rootId, existing);
                }
            }

            // Second pass: build root + replies groups (skip standalone replies whose root is in a different date group)
            for (const post of group.posts) {
                if (!post.rootId || post.rootId === '') {
                    rootPosts.push({
                        root: post,
                        replies: replyMap.get(post.id) ?? [],
                    });
                }
            }

            // Also include orphan replies (root post is in a different date group)
            const usedReplyIds = new Set(rootPosts.flatMap((rp) => rp.replies.map((r) => r.id)));
            for (const post of group.posts) {
                if (post.rootId && post.rootId !== '' && !usedReplyIds.has(post.id)) {
                    // Check if the root is in this group
                    const rootInGroup = group.posts.some((p) => p.id === post.rootId);
                    if (!rootInGroup) {
                        // Show as standalone reply bubble
                        rootPosts.push({ root: post, replies: [] });
                    }
                }
            }

            return { date: group.date, threads: rootPosts };
        });
    }, [dateGroups]);

    // Auto-scroll to bottom when new posts arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [posts]);

    const handleOpenThread = useCallback((rootId: string) => {
        openThread(rootId);
        postMessage('mattermost.getThread', { postId: rootId });
    }, [openThread]);

    const handleInsertEmoji = useCallback((shortcode: string) => {
        setMessageText((prev) => prev + shortcode);
        textareaRef.current?.focus();
    }, []);

    // Emoji shortcode autocomplete
    const {
        suggestions: emojiSuggestions,
        selectedIndex: emojiSelectedIndex,
        isOpen: emojiAutocompleteOpen,
        handleKeyDown: emojiKeyDown,
        handleChange: emojiHandleChange,
        acceptSuggestion: emojiAcceptSuggestion,
    } = useEmojiAutocomplete(textareaRef, messageText, setMessageText);

    // Send typing indicator (throttled)
    const sendTypingIndicator = useCallback(() => {
        if (!selectedChannelId) { return; }
        if (typingTimerRef.current) { return; } // Already sent recently
        postMessage('mattermost.sendTyping', { channelId: selectedChannelId });
        typingTimerRef.current = setTimeout(() => {
            typingTimerRef.current = null;
        }, 3000);
    }, [selectedChannelId]);

    const handleSend = useCallback(() => {
        const text = messageText.trim();
        if (!text || !selectedChannelId) { return; }
        postMessage('mattermost.sendPost', {
            channelId: selectedChannelId,
            message: text,
            rootId: replyToPostId ?? undefined,
        });
        setMessageText('');
        clearReplyTo();
    }, [messageText, selectedChannelId, replyToPostId, clearReplyTo]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            // Let emoji autocomplete handle keys first if it's open
            if (emojiAutocompleteOpen) {
                emojiKeyDown(e);
                if (e.defaultPrevented) { return; }
            }
            // Enter sends, Shift+Enter inserts newline
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        },
        [handleSend, emojiAutocompleteOpen, emojiKeyDown],
    );

    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            emojiHandleChange(e);
            sendTypingIndicator();
        },
        [sendTypingIndicator],
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
            {/* Connection banner */}
            <ConnectionBanner />

            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--vscode-panel-border)] shrink-0">
                <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={onClose}
                    className="md:hidden"
                    title="Back to channels"
                >
                    <ArrowLeft size={16} />
                </Button>
                <span className="text-sm font-semibold truncate flex-1">
                    # {selectedChannelName}
                </span>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleRefresh}
                    title="Refresh"
                >
                    <RefreshCw size={14} className={isLoadingPosts ? 'animate-spin' : ''} />
                </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto py-2">
                {/* Load more */}
                {hasMorePosts && posts.length > 0 && (
                    <div className="text-center py-2">
                        <Button
                            variant="link"
                            size="sm"
                            onClick={handleLoadMore}
                            disabled={isLoadingPosts}
                            className="inline-flex items-center gap-1"
                        >
                            <ChevronUp size={12} />
                            {isLoadingPosts ? 'Loading…' : 'Load older messages'}
                        </Button>
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
                    threadedGroups.map((group) => (
                        <div key={group.date}>
                            {/* Date separator */}
                            <div className="flex items-center gap-2 px-3 py-2">
                                <div className="flex-1 h-px bg-[var(--vscode-panel-border)]" />
                                <span className="text-xs text-fg/40 whitespace-nowrap">
                                    {group.date}
                                </span>
                                <div className="flex-1 h-px bg-[var(--vscode-panel-border)]" />
                            </div>
                            {group.threads.map(({ root, replies }) => (
                                <div key={root.id}>
                                    {/* Root post */}
                                    <MessageBubble
                                        post={root}
                                        currentUsername={currentUsername}
                                        currentUserId={currentUserId}
                                        onOpenThread={handleOpenThread}
                                    />

                                    {/* Collapsible inline thread replies */}
                                    {replies.length > 0 && (
                                        <div className="ml-4">
                                            <div className="flex items-center gap-1 px-3 py-0.5">
                                                <Button
                                                    variant="link"
                                                    size="sm"
                                                    onClick={() => toggleThread(root.id)}
                                                    className="h-auto p-0 gap-1 text-xs no-underline hover:underline"
                                                >
                                                    {expandedThreads.has(root.id) ? (
                                                        <ChevronDown size={12} />
                                                    ) : (
                                                        <ChevronRight size={12} />
                                                    )}
                                                    {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-xs"
                                                    onClick={() => handleOpenThread(root.id)}
                                                    title="Open thread"
                                                >
                                                    <ExternalLink size={11} />
                                                </Button>
                                            </div>
                                            {expandedThreads.has(root.id) && (
                                                <div>
                                                    {replies.map((reply) => (
                                                        <MessageBubble
                                                            key={reply.id}
                                                            post={reply}
                                                            currentUsername={currentUsername}
                                                            currentUserId={currentUserId}
                                                            onOpenThread={handleOpenThread}
                                                            isThreadReply
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Typing indicator */}
            {selectedChannelId && <TypingIndicator channelId={selectedChannelId} />}

            {/* Compose area */}
            <div className="shrink-0 border-t border-[var(--vscode-panel-border)] p-3">
                {/* Reply-to indicator */}
                {replyToPostId && (
                    <div className="flex items-center gap-2 mb-2 px-1 text-xs text-fg/60">
                        <MessageSquare size={12} className="text-[var(--vscode-textLink-foreground)]" />
                        <span>
                            Replying to <span className="font-semibold text-[var(--vscode-textLink-foreground)]">@{replyToUsername}</span>
                        </span>
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={clearReplyTo}
                            className="ml-auto"
                            title="Cancel reply"
                        >
                            <X size={12} />
                        </Button>
                    </div>
                )}
                <div className="relative">
                    {/* Emoji autocomplete dropdown */}
                    <EmojiAutocompleteDropdown
                        suggestions={emojiSuggestions}
                        selectedIndex={emojiSelectedIndex}
                        onSelect={emojiAcceptSuggestion}
                    />
                    <InputGroup>
                        <InputGroupTextarea
                            ref={textareaRef}
                            value={messageText}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder={replyToPostId ? "Reply… (Shift+Enter for new line)" : "Type a message… (Shift+Enter for new line)"}
                            rows={2}
                        />
                        <InputGroupAddon align="block-end">
                            <ComposeEmojiPickerButton onInsert={handleInsertEmoji} />
                            <Button
                                size="icon-sm"
                                onClick={handleSend}
                                disabled={!messageText.trim() || isSendingMessage}
                                className="ml-auto"
                                title="Send message (Enter)"
                            >
                                <Send size={14} />
                                <span className="sr-only">Send</span>
                            </Button>
                        </InputGroupAddon>
                    </InputGroup>
                </div>
            </div>
        </div>
    );
};
