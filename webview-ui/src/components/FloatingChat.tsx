import React, { useCallback, useRef, useEffect, useState } from 'react';
import { useAIStore } from '../aiStore';
import { postMessage } from '../vscode';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { MarkdownBody } from './MarkdownBody';
import {
    Send,
    Trash2,
    Loader2,
    Bot,
    User,
    X,
    Minus,
    GripVertical,
} from 'lucide-react';

// ─── Chat Bubble ──────────────────────────────────────────────────

const ChatBubble: React.FC<{
    role: 'user' | 'assistant';
    content: string;
    isStreaming?: boolean;
}> = React.memo(({ role, content, isStreaming }) => {
    const isUser = role === 'user';

    return (
        <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
            <div
                className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${
                    isUser
                        ? 'bg-accent/20 text-accent'
                        : 'bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]'
                }`}
            >
                {isUser ? <User size={10} /> : <Bot size={10} />}
            </div>
            <div
                className={`flex-1 min-w-0 rounded-lg px-2.5 py-2 text-[11px] leading-relaxed ${
                    isUser
                        ? 'bg-accent/10 text-fg'
                        : 'bg-[var(--vscode-editor-background)] text-fg/90 border border-border'
                }`}
            >
                {role === 'assistant' ? (
                    <MarkdownBody content={content || (isStreaming ? '…' : '')} className="text-[11px]" />
                ) : (
                    <span>{content}</span>
                )}
                {isStreaming && content && (
                    <span className="inline-block w-1.5 h-3 bg-accent/60 ml-0.5 animate-pulse" />
                )}
            </div>
        </div>
    );
});
ChatBubble.displayName = 'ChatBubble';

// ─── Persisted position/size ──────────────────────────────────────

interface PanelGeometry {
    x: number;
    y: number;
    width: number;
    height: number;
}

const DEFAULT_GEOMETRY: PanelGeometry = { x: -1, y: -1, width: 380, height: 480 };

function getPersistedGeometry(): PanelGeometry {
    try {
        const raw = localStorage.getItem('workstash-chat-geometry');
        if (raw) {
            return JSON.parse(raw) as PanelGeometry;
        }
    } catch { /* ignore */ }
    return { ...DEFAULT_GEOMETRY };
}

function persistGeometry(geo: PanelGeometry): void {
    try {
        localStorage.setItem('workstash-chat-geometry', JSON.stringify(geo));
    } catch { /* ignore */ }
}

// ─── Floating Chat Panel ──────────────────────────────────────────

export const FloatingChat: React.FC = () => {
    const chatMessages = useAIStore((s) => s.chatMessages);
    const chatInput = useAIStore((s) => s.chatInput);
    const setChatInput = useAIStore((s) => s.setChatInput);
    const isChatLoading = useAIStore((s) => s.isChatLoading);
    const clearChat = useAIStore((s) => s.clearChat);
    const setChatPanelOpen = useAIStore((s) => s.setChatPanelOpen);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [minimized, setMinimized] = useState(false);

    // Position & size state
    const [geo, setGeo] = useState<PanelGeometry>(() => {
        const saved = getPersistedGeometry();
        // If no saved position, we'll center it in componentDidMount
        return saved;
    });

    // Center on first render if no saved position
    useEffect(() => {
        if (geo.x === -1 && geo.y === -1) {
            const parent = panelRef.current?.parentElement;
            if (parent) {
                const pr = parent.getBoundingClientRect();
                const x = Math.max(10, pr.width - geo.width - 20);
                const y = Math.max(10, pr.height - geo.height - 20);
                const newGeo = { ...geo, x, y };
                setGeo(newGeo);
                persistGeometry(newGeo);
            }
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-scroll on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [chatMessages]);

    // ─── Drag logic ───────────────────────────────────────────
    const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

    const handleDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            originX: geo.x,
            originY: geo.y,
        };

        const handleDragMove = (ev: MouseEvent) => {
            if (!dragRef.current) { return; }
            const dx = ev.clientX - dragRef.current.startX;
            const dy = ev.clientY - dragRef.current.startY;
            const newGeo = {
                ...geo,
                x: Math.max(0, dragRef.current.originX + dx),
                y: Math.max(0, dragRef.current.originY + dy),
            };
            setGeo(newGeo);
        };

        const handleDragEnd = () => {
            if (dragRef.current) {
                setGeo((cur) => {
                    persistGeometry(cur);
                    return cur;
                });
                dragRef.current = null;
            }
            document.removeEventListener('mousemove', handleDragMove);
            document.removeEventListener('mouseup', handleDragEnd);
        };

        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
    }, [geo]);

    // ─── Resize logic ─────────────────────────────────────────
    const resizeRef = useRef<{ startX: number; startY: number; originW: number; originH: number } | null>(null);

    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        resizeRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            originW: geo.width,
            originH: geo.height,
        };

        const handleResizeMove = (ev: MouseEvent) => {
            if (!resizeRef.current) { return; }
            const dw = ev.clientX - resizeRef.current.startX;
            const dh = ev.clientY - resizeRef.current.startY;
            const newGeo = {
                ...geo,
                width: Math.max(280, resizeRef.current.originW + dw),
                height: Math.max(200, resizeRef.current.originH + dh),
            };
            setGeo(newGeo);
        };

        const handleResizeEnd = () => {
            if (resizeRef.current) {
                setGeo((cur) => {
                    persistGeometry(cur);
                    return cur;
                });
                resizeRef.current = null;
            }
            document.removeEventListener('mousemove', handleResizeMove);
            document.removeEventListener('mouseup', handleResizeEnd);
        };

        document.addEventListener('mousemove', handleResizeMove);
        document.addEventListener('mouseup', handleResizeEnd);
    }, [geo]);

    // ─── Chat actions ─────────────────────────────────────────
    const handleSend = useCallback(() => {
        const text = chatInput.trim();
        if (!text || isChatLoading) {
            return;
        }
        const currentMessages = useAIStore.getState().chatMessages;
        const history = currentMessages
            .filter((m) => !m.isStreaming)
            .map((m) => ({ role: m.role, content: m.content }));
        useAIStore.getState().addUserMessage(text);
        postMessage('ai.chat', { question: text, history });
    }, [chatInput, isChatLoading]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        },
        [handleSend],
    );

    const handleClose = useCallback(() => {
        setChatPanelOpen(false);
    }, [setChatPanelOpen]);

    const handleMinimize = useCallback(() => {
        setMinimized((prev) => !prev);
    }, []);

    // Don't render if position not yet computed
    if (geo.x === -1 && geo.y === -1) {
        return <div ref={panelRef} className="hidden" />;
    }

    return (
        <div
            ref={panelRef}
            className="absolute z-50 flex flex-col rounded-lg border border-border shadow-xl bg-[var(--vscode-sideBar-background)] overflow-hidden"
            style={{
                left: geo.x,
                top: geo.y,
                width: geo.width,
                height: minimized ? 'auto' : geo.height,
            }}
        >
            {/* ── Title bar (draggable) ── */}
            <div
                className="flex items-center gap-2 px-3 py-2 border-b border-border cursor-move select-none flex-shrink-0 bg-[var(--vscode-titleBar-activeBackground)]"
                onMouseDown={handleDragStart}
            >
                <GripVertical size={12} className="text-fg/30 flex-shrink-0" />
                <Bot size={12} className="text-accent flex-shrink-0" />
                <span className="text-[11px] font-semibold text-fg/70 flex-1">AI Chat</span>
                {chatMessages.length > 0 && (
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={clearChat}
                        title="Clear chat"
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <Trash2 size={10} />
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleMinimize}
                    title={minimized ? 'Expand' : 'Minimize'}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <Minus size={10} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleClose}
                    title="Close chat"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <X size={10} />
                </Button>
            </div>

            {!minimized && (
                <>
                    {/* ── Messages ── */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
                        {chatMessages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full gap-2 p-4 text-center">
                                <Bot size={24} className="text-fg/15" />
                                <p className="text-[11px] text-fg/30 max-w-[220px]">
                                    Ask me about your PRs, issues, stashes, projects, notes, or Mattermost messages
                                </p>
                                <div className="flex flex-col gap-1 mt-2 w-full max-w-[240px]">
                                    {[
                                        'What PRs need my review?',
                                        'Summarize open issues',
                                        'Any unread messages?',
                                    ].map((q) => (
                                        <Button
                                            key={q}
                                            variant="outline"
                                            size="sm"
                                            className="h-auto px-2.5 py-1.5 text-[10px] text-left justify-start"
                                            onClick={() => {
                                                useAIStore.getState().addUserMessage(q);
                                                postMessage('ai.chat', { question: q, history: [] });
                                            }}
                                        >
                                            {q}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3 p-3">
                                {chatMessages.map((msg) => (
                                    <ChatBubble
                                        key={msg.id}
                                        role={msg.role}
                                        content={msg.content}
                                        isStreaming={msg.isStreaming}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── Input ── */}
                    <div className="flex-shrink-0 border-t border-border p-2">
                        <div className="flex gap-1.5 items-end">
                            <Textarea
                                ref={inputRef}
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask about your workspace…"
                                className="flex-1 text-[11px] min-h-[32px] max-h-[80px] resize-none py-1.5"
                                rows={1}
                                disabled={isChatLoading}
                            />
                            <Button
                                variant="default"
                                size="icon-sm"
                                onClick={handleSend}
                                disabled={!chatInput.trim() || isChatLoading}
                                title="Send"
                            >
                                {isChatLoading ? (
                                    <Loader2 size={13} className="animate-spin" />
                                ) : (
                                    <Send size={13} />
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* ── Resize handle (bottom-right corner) ── */}
                    <div
                        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
                        onMouseDown={handleResizeStart}
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            className="text-fg/20"
                        >
                            <path
                                d="M14 14L8 14L14 8Z"
                                fill="currentColor"
                            />
                        </svg>
                    </div>
                </>
            )}
        </div>
    );
};
