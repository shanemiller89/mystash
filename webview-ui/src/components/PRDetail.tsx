import React, { useState, useCallback } from 'react';
import { usePRStore, type PRCommentData } from '../prStore';
import { postMessage } from '../vscode';
import {
    GitPullRequest,
    GitMerge,
    XCircle,
    ExternalLink,
    Copy,
    CopyCheck,
    Send,
    X,
    MessageSquare,
    FileDiff,
    Clock,
    GitBranch,
    FileCode,
} from 'lucide-react';
import { MarkdownBody } from './MarkdownBody';

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
}

function formatRelative(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function StateIcon({ state, isDraft }: { state: string; isDraft: boolean }) {
    if (isDraft) return <GitPullRequest size={16} className="text-fg/40" />;
    switch (state) {
        case 'open':
            return <GitPullRequest size={16} className="text-green-400" />;
        case 'merged':
            return <GitMerge size={16} className="text-purple-400" />;
        case 'closed':
            return <XCircle size={16} className="text-red-400" />;
        default:
            return <GitPullRequest size={16} className="text-fg/50" />;
    }
}

function StateBadge({ state, isDraft }: { state: string; isDraft: boolean }) {
    const colors = isDraft
        ? 'bg-fg/10 text-fg/50'
        : state === 'open'
          ? 'bg-green-400/15 text-green-400'
          : state === 'merged'
            ? 'bg-purple-400/15 text-purple-400'
            : 'bg-red-400/15 text-red-400';
    const label = isDraft ? 'Draft' : state.charAt(0).toUpperCase() + state.slice(1);
    return (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colors}`}>
            {label}
        </span>
    );
}

/** Render a diff hunk with basic syntax coloring */
const DiffHunk: React.FC<{ hunk: string }> = ({ hunk }) => {
    const lines = hunk.split('\n');
    return (
        <pre className="text-[10px] leading-[1.6] font-mono overflow-x-auto bg-[var(--vscode-textCodeBlock-background,rgba(127,127,127,0.1))] rounded p-2 my-1">
            {lines.map((line, i) => {
                let color = 'text-fg/60';
                if (line.startsWith('+')) {
                    color = 'text-green-400';
                } else if (line.startsWith('-')) {
                    color = 'text-red-400';
                } else if (line.startsWith('@@')) {
                    color = 'text-blue-400';
                }
                return (
                    <div key={i} className={color}>
                        {line}
                    </div>
                );
            })}
        </pre>
    );
};

/** Single comment card */
const CommentCard: React.FC<{ comment: PRCommentData }> = ({ comment }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
        postMessage('prs.copyComment', { body: comment.body });
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [comment.body]);

    return (
        <div className="border border-border rounded overflow-hidden">
            {/* Review comment file context */}
            {comment.isReviewComment && comment.path && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-[var(--vscode-textCodeBlock-background,rgba(127,127,127,0.08))] border-b border-border text-[10px] text-fg/50">
                    <FileCode size={10} className="shrink-0" />
                    <span className="font-mono truncate">{comment.path}</span>
                    {comment.line != null && (
                        <span className="shrink-0">:{comment.line}</span>
                    )}
                </div>
            )}
            {/* Diff hunk */}
            {comment.isReviewComment && comment.diffHunk && (
                <div className="border-b border-border px-2 py-1 max-h-32 overflow-y-auto">
                    <DiffHunk hunk={comment.diffHunk} />
                </div>
            )}
            {/* Comment header */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-card border-b border-border">
                {comment.authorAvatarUrl && (
                    <img
                        src={comment.authorAvatarUrl}
                        alt={comment.author}
                        className="w-4 h-4 rounded-full"
                    />
                )}
                <span className="text-[11px] font-medium">{comment.author}</span>
                {comment.isReviewComment && (
                    <span className="text-[9px] px-1 py-0.5 bg-blue-400/10 text-blue-400 rounded">review</span>
                )}
                <span className="text-[10px] text-fg/40" title={formatDate(comment.createdAt)}>
                    {formatRelative(comment.createdAt)}
                </span>
                <div className="flex-1" />
                <button
                    className="p-0.5 text-fg/30 hover:text-fg transition-colors"
                    onClick={handleCopy}
                    title="Copy comment"
                >
                    {copied ? <CopyCheck size={11} /> : <Copy size={11} />}
                </button>
            </div>
            {/* Comment body — rendered as markdown */}
            <div className="px-3 py-2">
                <MarkdownBody content={comment.body} />
            </div>
        </div>
    );
};

interface PRDetailProps {
    onClose: () => void;
}

export const PRDetail: React.FC<PRDetailProps> = ({ onClose }) => {
    const selectedPR = usePRStore((s) => s.selectedPR());
    const selectedPRDetail = usePRStore((s) => s.selectedPRDetail);
    const comments = usePRStore((s) => s.comments);
    const isCommentsLoading = usePRStore((s) => s.isCommentsLoading);
    const isCommentSaving = usePRStore((s) => s.isCommentSaving);

    const [newComment, setNewComment] = useState('');

    // Use detail (full) data if available, otherwise fall back to list data
    const pr = selectedPRDetail ?? selectedPR;

    const handleOpenInBrowser = useCallback(() => {
        if (pr) {
            postMessage('prs.openInBrowser', { prNumber: pr.number });
        }
    }, [pr]);

    const handleCopyAll = useCallback(() => {
        if (comments.length === 0) return;
        const formatted = comments
            .map(
                (c) =>
                    `${c.author} (${formatRelative(c.createdAt)}):\n${c.body}`,
            )
            .join('\n\n---\n\n');
        postMessage('prs.copyAllComments', { body: formatted });
    }, [comments]);

    const handleSubmitComment = useCallback(() => {
        if (!pr || !newComment.trim()) return;
        postMessage('prs.createComment', { prNumber: pr.number, body: newComment.trim() });
        setNewComment('');
    }, [pr, newComment]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmitComment();
            }
        },
        [handleSubmitComment],
    );

    if (!pr) {
        return (
            <div className="h-full flex items-center justify-center text-fg/30 text-[11px]">
                Select a PR to view details
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-border p-3">
                <div className="flex items-start gap-2">
                    <StateIcon state={pr.state} isDraft={pr.isDraft} />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[13px] font-medium">{pr.title}</span>
                            <span className="text-fg/40 text-[11px]">#{pr.number}</span>
                            <StateBadge state={pr.state} isDraft={pr.isDraft} />
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-fg/40 flex-wrap">
                            <span className="flex items-center gap-1">
                                <GitBranch size={10} />
                                {pr.branch} → {pr.baseBranch}
                            </span>
                            <span className="flex items-center gap-1">
                                <Clock size={10} />
                                {formatRelative(pr.updatedAt)}
                            </span>
                            {selectedPRDetail && (
                                <span className="flex items-center gap-1">
                                    <FileDiff size={10} />
                                    <span className="text-green-400">+{pr.additions}</span>
                                    <span className="text-red-400">-{pr.deletions}</span>
                                    <span>· {pr.changedFiles} files</span>
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                            className="p-1 text-fg/40 hover:text-fg transition-colors"
                            onClick={handleOpenInBrowser}
                            title="Open in browser"
                        >
                            <ExternalLink size={13} />
                        </button>
                        <button
                            className="p-1 text-fg/40 hover:text-fg transition-colors"
                            onClick={onClose}
                            title="Close"
                        >
                            <X size={13} />
                        </button>
                    </div>
                </div>

                {/* Labels */}
                {pr.labels.length > 0 && (
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                        {pr.labels.map((l) => (
                            <span
                                key={l.name}
                                className="text-[9px] px-1.5 py-0.5 rounded-full"
                                style={{
                                    backgroundColor: `#${l.color}20`,
                                    color: `#${l.color}`,
                                    border: `1px solid #${l.color}40`,
                                }}
                            >
                                {l.name}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Body + Comments scrollable area */}
            <div className="flex-1 overflow-y-auto">
                {/* PR description */}
                {pr.body && (
                    <div className="px-3 py-3 border-b border-border">
                        <div className="text-[10px] text-fg/40 uppercase tracking-wider mb-1.5 font-medium">
                            Description
                        </div>
                        <MarkdownBody content={pr.body} className="text-fg/80" />
                    </div>
                )}

                {/* Comments section */}
                <div className="px-3 py-3">
                    <div className="flex items-center gap-2 mb-3">
                        <MessageSquare size={12} className="text-fg/40" />
                        <span className="text-[10px] text-fg/40 uppercase tracking-wider font-medium">
                            Comments ({comments.length})
                        </span>
                        <div className="flex-1" />
                        {comments.length > 0 && (
                            <button
                                className="flex items-center gap-1 text-[10px] text-fg/40 hover:text-fg transition-colors"
                                onClick={handleCopyAll}
                                title="Copy all comments"
                            >
                                <Copy size={10} />
                                Copy all
                            </button>
                        )}
                    </div>

                    {isCommentsLoading ? (
                        <div className="text-center py-4 text-fg/40 text-[11px]">
                            Loading comments…
                        </div>
                    ) : comments.length === 0 ? (
                        <div className="text-center py-4 text-fg/30 text-[11px]">
                            No comments yet
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {comments.map((c) => (
                                <CommentCard key={c.id} comment={c} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* New comment input */}
            <div className="flex-shrink-0 border-t border-border p-3">
                <div className="flex gap-2">
                    <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Leave a comment… (⌘+Enter to submit)"
                        rows={2}
                        className="flex-1 px-2 py-1.5 text-[11px] bg-input border border-border rounded resize-none focus:border-accent focus:outline-none"
                    />
                    <button
                        className="self-end p-2 bg-accent text-white rounded hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                        onClick={handleSubmitComment}
                        disabled={!newComment.trim() || isCommentSaving}
                        title="Post comment"
                    >
                        <Send size={13} />
                    </button>
                </div>
                {isCommentSaving && (
                    <div className="text-[10px] text-fg/40 mt-1">Posting comment…</div>
                )}
            </div>
        </div>
    );
};
