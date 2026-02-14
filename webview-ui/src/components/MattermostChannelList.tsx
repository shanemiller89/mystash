import React, { useCallback, useMemo } from 'react';
import { useMattermostStore, type MattermostChannelData } from '../mattermostStore';
import { postMessage } from '../vscode';
import {
    Globe,
    Lock,
    Search,
    RefreshCw,
    ChevronDown,
} from 'lucide-react';

function ChannelIcon({ type, size = 14 }: { type: string; size?: number }) {
    switch (type) {
        case 'O':
            return <Globe size={size} className="text-fg/50" />;
        case 'P':
            return <Lock size={size} className="text-yellow-400" />;
        default:
            return <Globe size={size} className="text-fg/50" />;
    }
}

function formatLastPost(iso: string): string {
    if (!iso) { return ''; }
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) { return 'just now'; }
    if (diffMins < 60) { return `${diffMins}m ago`; }
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) { return `${diffHours}h ago`; }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) { return `${diffDays}d ago`; }
    return date.toLocaleDateString();
}

export const MattermostChannelList: React.FC = () => {
    const teams = useMattermostStore((s) => s.teams);
    const allChannels = useMattermostStore((s) => s.channels);
    const isConfigured = useMattermostStore((s) => s.isConfigured);
    const isLoadingChannels = useMattermostStore((s) => s.isLoadingChannels);
    const selectedTeamId = useMattermostStore((s) => s.selectedTeamId);
    const selectedChannelId = useMattermostStore((s) => s.selectedChannelId);
    const selectTeam = useMattermostStore((s) => s.selectTeam);
    const selectChannel = useMattermostStore((s) => s.selectChannel);
    const searchQuery = useMattermostStore((s) => s.searchQuery);
    const setSearchQuery = useMattermostStore((s) => s.setSearchQuery);

    const channels = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) { return allChannels; }
        return allChannels.filter(
            (c) =>
                c.displayName.toLowerCase().includes(q) ||
                c.name.toLowerCase().includes(q),
        );
    }, [allChannels, searchQuery]);

    const selectedTeam = useMemo(
        () => teams.find((t) => t.id === selectedTeamId),
        [teams, selectedTeamId],
    );

    const handleTeamSelect = useCallback(
        (teamId: string) => {
            selectTeam(teamId);
            postMessage('mattermost.getChannels', { teamId });
        },
        [selectTeam],
    );

    const handleChannelSelect = useCallback(
        (channel: MattermostChannelData) => {
            selectChannel(channel.id, channel.displayName);
            postMessage('mattermost.getPosts', { channelId: channel.id });
        },
        [selectChannel],
    );

    const handleRefresh = useCallback(() => {
        if (selectedTeamId) {
            postMessage('mattermost.getChannels', { teamId: selectedTeamId });
        } else {
            postMessage('mattermost.refresh');
        }
    }, [selectedTeamId]);

    const handleSignInWithPassword = useCallback(() => {
        postMessage('mattermost.signInWithPassword');
    }, []);

    const handleSignInWithToken = useCallback(() => {
        postMessage('mattermost.signInWithToken');
    }, []);

    const handleSignInWithSessionToken = useCallback(() => {
        postMessage('mattermost.signInWithSessionToken');
    }, []);

    // Not configured state
    if (!isConfigured) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
                <div className="text-fg/40 mb-1">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                </div>
                <p className="text-sm text-fg/60">
                    Sign in to Mattermost to view your channels.
                </p>
                <div className="flex flex-col gap-2 w-full max-w-[220px]">
                    <button
                        onClick={handleSignInWithPassword}
                        className="px-4 py-2 text-sm font-medium rounded-md bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
                    >
                        Sign In with Password
                    </button>
                    <button
                        onClick={handleSignInWithSessionToken}
                        className="px-4 py-2 text-sm font-medium rounded-md bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
                    >
                        Use Session Token
                    </button>
                    <button
                        onClick={handleSignInWithToken}
                        className="px-4 py-2 text-sm font-medium rounded-md bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
                    >
                        Use Access Token
                    </button>
                </div>
                <p className="text-xs text-fg/40 mt-1">
                    Supports MFA/2FA. Access tokens require admin setup.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Team selector */}
            <div className="flex items-center gap-2 p-3 border-b border-[var(--vscode-panel-border)]">
                {teams.length > 1 ? (
                    <div className="relative flex-1">
                        <select
                            value={selectedTeamId ?? ''}
                            onChange={(e) => handleTeamSelect(e.target.value)}
                            className="w-full px-3 py-1.5 text-sm rounded-md appearance-none
                                bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)]
                                border border-[var(--vscode-input-border)]
                                focus:outline-none focus:border-[var(--vscode-focusBorder)]"
                        >
                            {teams.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.displayName}
                                </option>
                            ))}
                        </select>
                        <ChevronDown
                            size={14}
                            className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-fg/50"
                        />
                    </div>
                ) : selectedTeam ? (
                    <span className="flex-1 text-sm font-medium truncate">
                        {selectedTeam.displayName}
                    </span>
                ) : null}

                <button
                    onClick={handleRefresh}
                    className="p-1 rounded hover:bg-[var(--vscode-toolbar-hoverBackground)] text-fg/60"
                    title="Refresh"
                >
                    <RefreshCw size={14} className={isLoadingChannels ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Search */}
            <div className="px-3 py-2 border-b border-[var(--vscode-panel-border)]">
                <div className="relative">
                    <Search
                        size={14}
                        className="absolute left-2 top-1/2 -translate-y-1/2 text-fg/40"
                    />
                    <input
                        type="text"
                        placeholder="Search channels…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-7 pr-2 py-1 text-sm rounded-md
                            bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)]
                            border border-[var(--vscode-input-border)]
                            focus:outline-none focus:border-[var(--vscode-focusBorder)]
                            placeholder:text-fg/40"
                    />
                </div>
            </div>

            {/* Channel list */}
            <div className="flex-1 overflow-y-auto">
                {isLoadingChannels ? (
                    <div className="flex items-center justify-center h-24 text-sm text-fg/50">
                        Loading channels…
                    </div>
                ) : channels.length === 0 ? (
                    <div className="flex items-center justify-center h-24 text-sm text-fg/50">
                        {searchQuery ? 'No matching channels' : 'No channels found'}
                    </div>
                ) : (
                    channels.map((channel) => (
                        <button
                            key={channel.id}
                            onClick={() => handleChannelSelect(channel)}
                            className={`w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-[var(--vscode-list-hoverBackground)] transition-colors ${
                                selectedChannelId === channel.id
                                    ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
                                    : ''
                            }`}
                        >
                            <ChannelIcon type={channel.type} size={16} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-sm font-medium truncate">
                                        {channel.displayName}
                                    </span>
                                    {channel.lastPostAt && (
                                        <span className="text-xs text-fg/40 whitespace-nowrap">
                                            {formatLastPost(channel.lastPostAt)}
                                        </span>
                                    )}
                                </div>
                                {channel.purpose && (
                                    <p className="text-xs text-fg/50 truncate mt-0.5">
                                        {channel.purpose}
                                    </p>
                                )}
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
};
