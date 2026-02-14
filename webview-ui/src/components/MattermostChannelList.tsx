import React, { useCallback, useMemo, useState } from 'react';
import { useMattermostStore, type MattermostChannelData } from '../mattermostStore';
import { postMessage } from '../vscode';
import {
    Globe,
    Lock,
    Search,
    RefreshCw,
    ChevronDown,
    ChevronRight,
    MessageCircle,
    Users,
    Plus,
    X,
    Circle,
} from 'lucide-react';

function ChannelIcon({ type, size = 14 }: { type: string; size?: number }) {
    switch (type) {
        case 'O':
            return <Globe size={size} className="text-fg/50 shrink-0" />;
        case 'P':
            return <Lock size={size} className="text-yellow-400 shrink-0" />;
        case 'D':
            return <MessageCircle size={size} className="text-blue-400 shrink-0" />;
        case 'G':
            return <Users size={size} className="text-purple-400 shrink-0" />;
        default:
            return <Globe size={size} className="text-fg/50 shrink-0" />;
    }
}

/** Small coloured status dot */
function StatusDot({ status, size = 8 }: { status?: string; size?: number }) {
    const color = (() => {
        switch (status) {
            case 'online':  return '#22c55e'; // green
            case 'away':    return '#f59e0b'; // amber
            case 'dnd':     return '#ef4444'; // red
            default:        return 'transparent';
        }
    })();
    if (!status || status === 'offline') {
        return (
            <Circle
                size={size}
                className="shrink-0 text-fg/30"
                strokeWidth={2}
            />
        );
    }
    return (
        <Circle
            size={size}
            className="shrink-0"
            fill={color}
            stroke={color}
            strokeWidth={0}
        />
    );
}

function UnreadBadge({ count, mentions }: { count: number; mentions: number }) {
    if (count <= 0 && mentions <= 0) { return null; }
    if (mentions > 0) {
        return (
            <span className="ml-auto shrink-0 bg-[var(--vscode-notificationsErrorIcon-foreground,#f14c4c)] text-white text-[10px] font-bold leading-none rounded-full px-1.5 py-0.5 min-w-[16px] text-center">
                {mentions}
            </span>
        );
    }
    return (
        <span className="ml-auto shrink-0 w-2 h-2 rounded-full bg-[var(--vscode-notificationsInfoIcon-foreground,#3794ff)]" />
    );
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

/** Collapsible section header */
function SectionHeader({
    title,
    isOpen,
    onToggle,
    action,
}: {
    title: string;
    isOpen: boolean;
    onToggle: () => void;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg/50 select-none">
            <button onClick={onToggle} className="flex items-center gap-1 hover:text-fg/80 transition-colors">
                {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {title}
            </button>
            {action && <div className="ml-auto">{action}</div>}
        </div>
    );
}

/** New DM dialog — searches users and starts a DM */
function NewDmDialog({ onClose }: { onClose: () => void }) {
    const [searchTerm, setSearchTerm] = useState('');
    const userSearchResults = useMattermostStore((s) => s.userSearchResults);
    const isSearchingUsers = useMattermostStore((s) => s.isSearchingUsers);
    const clearUserSearchResults = useMattermostStore((s) => s.clearUserSearchResults);
    const setIsSearchingUsers = useMattermostStore((s) => s.setIsSearchingUsers);

    const handleSearch = useCallback((term: string) => {
        setSearchTerm(term);
        if (term.trim().length >= 2) {
            setIsSearchingUsers(true);
            postMessage('mattermost.searchUsers', { term: term.trim() });
        } else {
            clearUserSearchResults();
        }
    }, [clearUserSearchResults, setIsSearchingUsers]);

    const handleSelectUser = useCallback((userId: string) => {
        postMessage('mattermost.createDM', { targetUserId: userId });
        clearUserSearchResults();
        onClose();
    }, [clearUserSearchResults, onClose]);

    return (
        <div className="px-3 py-2 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)]">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-fg/70">New Direct Message</span>
                <button onClick={onClose} className="ml-auto p-0.5 rounded hover:bg-[var(--vscode-toolbar-hoverBackground)]">
                    <X size={12} className="text-fg/50" />
                </button>
            </div>
            <input
                type="text"
                placeholder="Search users…"
                autoFocus
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full px-2 py-1 text-sm rounded-md
                    bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)]
                    border border-[var(--vscode-input-border)]
                    focus:outline-none focus:border-[var(--vscode-focusBorder)]
                    placeholder:text-fg/40"
            />
            {isSearchingUsers && (
                <div className="mt-1 text-xs text-fg/50 px-1">Searching…</div>
            )}
            {!isSearchingUsers && userSearchResults.length > 0 && (
                <div className="mt-1 max-h-[160px] overflow-y-auto">
                    {userSearchResults.map((u) => (
                        <button
                            key={u.id}
                            onClick={() => handleSelectUser(u.id)}
                            className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-[var(--vscode-list-hoverBackground)] flex items-center gap-2"
                        >
                            <MessageCircle size={12} className="text-blue-400 shrink-0" />
                            <span className="font-medium">{u.username}</span>
                            {(u.firstName || u.lastName) && (
                                <span className="text-fg/50 text-xs truncate">
                                    {u.firstName} {u.lastName}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export const MattermostChannelList: React.FC = () => {
    const teams = useMattermostStore((s) => s.teams);
    const allChannels = useMattermostStore((s) => s.channels);
    const allDmChannels = useMattermostStore((s) => s.dmChannels);
    const isConfigured = useMattermostStore((s) => s.isConfigured);
    const isLoadingChannels = useMattermostStore((s) => s.isLoadingChannels);
    const selectedTeamId = useMattermostStore((s) => s.selectedTeamId);
    const selectedChannelId = useMattermostStore((s) => s.selectedChannelId);
    const selectTeam = useMattermostStore((s) => s.selectTeam);
    const selectChannel = useMattermostStore((s) => s.selectChannel);
    const searchQuery = useMattermostStore((s) => s.searchQuery);
    const setSearchQuery = useMattermostStore((s) => s.setSearchQuery);
    const unreads = useMattermostStore((s) => s.unreads);
    const userStatuses = useMattermostStore((s) => s.userStatuses);

    const [channelsOpen, setChannelsOpen] = useState(true);
    const [dmsOpen, setDmsOpen] = useState(true);
    const [showNewDm, setShowNewDm] = useState(false);

    const channels = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) { return allChannels; }
        return allChannels.filter(
            (c) =>
                c.displayName.toLowerCase().includes(q) ||
                c.name.toLowerCase().includes(q),
        );
    }, [allChannels, searchQuery]);

    const dmChannels = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) { return allDmChannels; }
        return allDmChannels.filter(
            (c) =>
                c.displayName.toLowerCase().includes(q) ||
                c.name.toLowerCase().includes(q),
        );
    }, [allDmChannels, searchQuery]);

    const selectedTeam = useMemo(
        () => teams.find((t) => t.id === selectedTeamId),
        [teams, selectedTeamId],
    );

    const handleTeamSelect = useCallback(
        (teamId: string) => {
            selectTeam(teamId);
            postMessage('mattermost.getAllChannels', { teamId });
        },
        [selectTeam],
    );

    const handleChannelSelect = useCallback(
        (channel: MattermostChannelData) => {
            selectChannel(channel.id, channel.displayName);
            postMessage('mattermost.getPosts', { channelId: channel.id });
            postMessage('mattermost.markRead', { channelId: channel.id });
        },
        [selectChannel],
    );

    const handleRefresh = useCallback(() => {
        if (selectedTeamId) {
            postMessage('mattermost.getAllChannels', { teamId: selectedTeamId });
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

    // Render a single channel row
    const renderChannel = (channel: MattermostChannelData) => {
        const unread = unreads[channel.id];
        const hasUnread = unread && (unread.msgCount > 0 || unread.mentionCount > 0);
        const isDm = channel.type === 'D';
        const dmStatus = isDm && channel.otherUserId ? userStatuses[channel.otherUserId] : undefined;
        return (
            <button
                key={channel.id}
                onClick={() => handleChannelSelect(channel)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[var(--vscode-list-hoverBackground)] transition-colors ${
                    selectedChannelId === channel.id
                        ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
                        : ''
                } ${hasUnread ? 'font-semibold' : ''}`}
            >
                {isDm ? (
                    <StatusDot status={dmStatus} size={10} />
                ) : (
                    <ChannelIcon type={channel.type} size={14} />
                )}
                <span className="text-sm truncate flex-1">
                    {channel.displayName}
                </span>
                {unread && (
                    <UnreadBadge count={unread.msgCount} mentions={unread.mentionCount} />
                )}
            </button>
        );
    };

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

            {/* New DM dialog */}
            {showNewDm && <NewDmDialog onClose={() => setShowNewDm(false)} />}

            {/* Channel list with sections */}
            <div className="flex-1 overflow-y-auto">
                {isLoadingChannels ? (
                    <div className="flex items-center justify-center h-24 text-sm text-fg/50">
                        Loading channels…
                    </div>
                ) : (
                    <>
                        {/* Channels section */}
                        <SectionHeader
                            title="Channels"
                            isOpen={channelsOpen}
                            onToggle={() => setChannelsOpen((v) => !v)}
                        />
                        {channelsOpen && (
                            channels.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-fg/40">
                                    {searchQuery ? 'No matching channels' : 'No channels'}
                                </div>
                            ) : (
                                channels.map(renderChannel)
                            )
                        )}

                        {/* Direct Messages section */}
                        <SectionHeader
                            title="Direct Messages"
                            isOpen={dmsOpen}
                            onToggle={() => setDmsOpen((v) => !v)}
                            action={
                                <button
                                    onClick={() => setShowNewDm(true)}
                                    className="p-0.5 rounded hover:bg-[var(--vscode-toolbar-hoverBackground)] text-fg/50 hover:text-fg/80"
                                    title="New Direct Message"
                                >
                                    <Plus size={12} />
                                </button>
                            }
                        />
                        {dmsOpen && (
                            dmChannels.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-fg/40">
                                    {searchQuery ? 'No matching DMs' : 'No direct messages'}
                                </div>
                            ) : (
                                dmChannels.map(renderChannel)
                            )
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
