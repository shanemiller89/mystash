import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Group, Panel, Separator, type Layout } from 'react-resizable-panels';
import { useMattermostStore } from '../mattermostStore';
import { MattermostChannelList } from './MattermostChannelList';
import { MattermostChat } from './MattermostChat';
import { MattermostThreadPanel } from './MattermostThreadPanel';
import { ResizableLayout } from './ResizableLayout';
import { ErrorBoundary } from './ErrorBoundary';

/** Persist thread panel size */
function getPersistedThreadSize(): number {
    try {
        const raw = localStorage.getItem('resizable-mattermost-thread');
        if (raw) { return JSON.parse(raw) as number; }
    } catch { /* ignore */ }
    return 40;
}
function persistThreadSize(size: number): void {
    try {
        localStorage.setItem('resizable-mattermost-thread', JSON.stringify(size));
    } catch { /* ignore */ }
}

/**
 * Chat + Thread horizontal split.
 * When a thread is open, the chat area splits into Chat | ThreadPanel
 * using react-resizable-panels for a Slack-style layout.
 */
const ChatWithThread: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const activeThreadRootId = useMattermostStore((s) => s.activeThreadRootId);
    const hasThread = activeThreadRootId !== null;

    const threadDefaultSize = getPersistedThreadSize();

    const handleThreadLayoutChanged = useCallback((layout: Layout) => {
        const threadSize = layout['thread'];
        if (threadSize !== undefined) {
            persistThreadSize(threadSize);
        }
    }, []);

    if (!hasThread) {
        return <MattermostChat onClose={onClose} />;
    }

    return (
        <Group
            id="workstash-mattermost-thread"
            orientation="horizontal"
            onLayoutChanged={handleThreadLayoutChanged}
        >
            <Panel
                id="chat"
                defaultSize={`${100 - threadDefaultSize}%`}
                minSize="30%"
            >
                <div className="h-full overflow-hidden">
                    <ErrorBoundary label="Chat">
                        <MattermostChat onClose={onClose} />
                    </ErrorBoundary>
                </div>
            </Panel>
            <Separator className="resize-handle" />
            <Panel
                id="thread"
                defaultSize={`${threadDefaultSize}%`}
                minSize="20%"
            >
                <div className="h-full overflow-hidden">
                    <ErrorBoundary label="Thread">
                        <MattermostThreadPanel />
                    </ErrorBoundary>
                </div>
            </Panel>
        </Group>
    );
};

export const MattermostTab: React.FC = () => {
    const selectedChannelId = useMattermostStore((s) => s.selectedChannelId);
    const clearChannelSelection = useMattermostStore((s) => s.clearChannelSelection);

    const handleCloseDetail = useCallback(() => {
        clearChannelSelection();
    }, [clearChannelSelection]);

    const hasSelection = selectedChannelId !== null;

    return (
        <ResizableLayout
            storageKey="mattermost"
            hasSelection={hasSelection}
            backLabel="Back to Channels"
            onBack={handleCloseDetail}
            listContent={<MattermostChannelList />}
            detailContent={<ChatWithThread onClose={handleCloseDetail} />}
        />
    );
};
