import React, { useCallback } from 'react';
import { usePRStore } from '../prStore';
import { postMessage } from '../vscode';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { MarkdownBody } from './MarkdownBody';
import { ScrollArea } from './ui/scroll-area';
import { CopyMarkdownButton } from './CopyMarkdownButton';
import {
    Sparkles,
    Loader2,
    RefreshCw,
    XCircle,
    X,
    PanelRightOpen,
} from 'lucide-react';

// ─── Inline trigger bar (goes inside Files Changed tab) ──────────

/**
 * PRFilesSummaryTrigger — a thin bar at the top of the Files Changed tab.
 * Shows a "Summarize" button, loading spinner, error, or "View summary" toggle.
 */
export const PRFilesSummary: React.FC<{ prNumber: number }> = ({ prNumber }) => {
    const filesSummary = usePRStore((s) => s.filesSummary);
    const isLoading = usePRStore((s) => s.isFilesSummaryLoading);
    const error = usePRStore((s) => s.filesSummaryError);
    const prFiles = usePRStore((s) => s.prFiles);
    const paneOpen = usePRStore((s) => s.filesSummaryPaneOpen);
    const setPaneOpen = usePRStore((s) => s.setFilesSummaryPaneOpen);

    const handleGenerate = useCallback(() => {
        postMessage('prs.generateFilesSummary', { prNumber });
    }, [prNumber]);

    if (prFiles.length === 0) { return null; }

    // Initial — no summary yet
    if (!filesSummary && !isLoading && !error) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-[var(--vscode-editor-background)]">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-[11px] text-fg/60 hover:text-fg"
                    onClick={handleGenerate}
                >
                    <Sparkles size={12} />
                    Summarize file changes with AI
                </Button>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-fg/40 border-fg/20">
                    {prFiles.length} file{prFiles.length !== 1 ? 's' : ''}
                </Badge>
            </div>
        );
    }

    // Loading
    if (isLoading) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-[var(--vscode-editor-background)]">
                <Loader2 size={13} className="animate-spin text-fg/40" />
                <span className="text-[11px] text-fg/50">Analyzing file changes…</span>
            </div>
        );
    }

    // Error
    if (error) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-[var(--vscode-editor-background)]">
                <XCircle size={12} className="text-red-400 shrink-0" />
                <span className="text-[11px] text-red-400 flex-1 truncate">{error}</span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 text-[10px] text-fg/50 hover:text-fg"
                    onClick={handleGenerate}
                >
                    <RefreshCw size={10} />
                    Retry
                </Button>
            </div>
        );
    }

    // Summary available — show toggle bar
    return (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-[var(--vscode-editor-background)]">
            <Sparkles size={12} className="text-yellow-400 shrink-0" />
            <span className="text-[11px] font-medium text-fg/70 flex-1">AI File Change Summary</span>
            <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 text-[10px]"
                onClick={() => setPaneOpen(!paneOpen)}
            >
                <PanelRightOpen size={11} />
                {paneOpen ? 'Hide' : 'Show'}
            </Button>
        </div>
    );
};

// ─── Right pane (rendered in PRDetail alongside main content) ────

interface PRFilesSummaryPaneProps {
    prNumber: number;
    width: number;
    onResizeStart: (e: React.MouseEvent) => void;
}

/**
 * PRFilesSummaryPane — resizable right pane showing the full AI file change summary.
 */
export const PRFilesSummaryPane: React.FC<PRFilesSummaryPaneProps> = ({
    prNumber,
    width,
    onResizeStart,
}) => {
    const filesSummary = usePRStore((s) => s.filesSummary);
    const isLoading = usePRStore((s) => s.isFilesSummaryLoading);
    const setPaneOpen = usePRStore((s) => s.setFilesSummaryPaneOpen);

    const handleRegenerate = useCallback(() => {
        postMessage('prs.generateFilesSummary', { prNumber });
    }, [prNumber]);

    return (
        <div
            className="shrink-0 border-l border-border flex flex-col min-h-0 relative"
            style={{ width }}
        >
            {/* Resize handle (left edge) */}
            <div
                className="absolute top-0 left-0 w-1 h-full cursor-col-resize z-10 hover:bg-accent/30 active:bg-accent/50 transition-colors"
                onMouseDown={onResizeStart}
            />

            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-[var(--vscode-editor-background)] shrink-0">
                <Sparkles size={12} className="text-yellow-400 shrink-0" />
                <span className="text-[11px] font-semibold text-fg/70 flex-1 truncate">
                    File Change Summary
                </span>
                <div className="flex items-center gap-0.5">
                    <CopyMarkdownButton content={filesSummary ?? ''} iconSize={11} />
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={handleRegenerate}
                        disabled={isLoading}
                        title="Regenerate summary"
                    >
                        {isLoading ? (
                            <Loader2 size={11} className="animate-spin" />
                        ) : (
                            <RefreshCw size={11} />
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setPaneOpen(false)}
                        title="Close pane"
                    >
                        <X size={11} />
                    </Button>
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex-1 flex items-center justify-center text-fg/40 text-[11px]">
                    <Loader2 size={14} className="animate-spin mr-2" />
                    Analyzing file changes…
                </div>
            ) : filesSummary ? (
                <ScrollArea className="flex-1">
                    <div className="px-4 py-3">
                        <MarkdownBody
                            content={filesSummary}
                            className="text-[11.5px] leading-relaxed"
                        />
                    </div>
                </ScrollArea>
            ) : (
                <div className="flex-1 flex items-center justify-center text-fg/30 text-[11px]">
                    No summary generated yet
                </div>
            )}
        </div>
    );
};
