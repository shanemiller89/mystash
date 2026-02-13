import React, { useCallback } from 'react';
import { usePRStore, type PRStateFilter } from '../prStore';
import { useNotesStore } from '../notesStore';
import { postMessage } from '../vscode';
import {
    GitPullRequest,
    GitMerge,
    XCircle,
    Search,
    RefreshCw,
    ExternalLink,
} from 'lucide-react';

const stateFilters: { key: PRStateFilter; label: string }[] = [
    { key: 'open', label: 'Open' },
    { key: 'merged', label: 'Merged' },
    { key: 'closed', label: 'Closed' },
    { key: 'all', label: 'All' },
];

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

function StateIcon({
    state,
    isDraft,
    size = 14,
}: {
    state: string;
    isDraft: boolean;
    size?: number;
}) {
    if (isDraft) {
        return <GitPullRequest size={size} className="text-fg/40" />;
    }
    switch (state) {
        case 'open':
            return <GitPullRequest size={size} className="text-green-400" />;
        case 'merged':
            return <GitMerge size={size} className="text-purple-400" />;
        case 'closed':
            return <XCircle size={size} className="text-red-400" />;
        default:
            return <GitPullRequest size={size} className="text-fg/50" />;
    }
}

export const PRList: React.FC = () => {
    const prs = usePRStore((s) => s.filteredPRs());
    const allPRs = usePRStore((s) => s.prs);
    const isLoading = usePRStore((s) => s.isLoading);
    const isRepoNotFound = usePRStore((s) => s.isRepoNotFound);
    const stateFilter = usePRStore((s) => s.stateFilter);
    const setStateFilter = usePRStore((s) => s.setStateFilter);
    const selectPR = usePRStore((s) => s.selectPR);
    const selectedPRNumber = usePRStore((s) => s.selectedPRNumber);
    const searchQuery = usePRStore((s) => s.searchQuery);
    const setSearchQuery = usePRStore((s) => s.setSearchQuery);
    const isAuthenticated = useNotesStore((s) => s.isAuthenticated);

    const handleFilterChange = useCallback(
        (filter: PRStateFilter) => {
            setStateFilter(filter);
            postMessage('prs.filter', { state: filter });
        },
        [setStateFilter],
    );

    const handleRefresh = useCallback(() => {
        postMessage('prs.refresh');
    }, []);

    const handleSelectPR = useCallback(
        (prNumber: number) => {
            selectPR(prNumber);
            postMessage('prs.getComments', { prNumber });
        },
        [selectPR],
    );

    // Not authenticated
    if (!isAuthenticated) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                <GitPullRequest size={32} className="text-fg/30" />
                <p className="text-fg/60 text-[12px]">
                    Sign in to GitHub to see your pull requests.
                </p>
                <button
                    className="px-3 py-1.5 bg-accent text-white text-[11px] rounded hover:opacity-90 transition-opacity"
                    onClick={() => postMessage('prs.signIn')}
                >
                    Sign In to GitHub
                </button>
            </div>
        );
    }

    // Not a GitHub repo
    if (isRepoNotFound) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                <GitPullRequest size={32} className="text-fg/30" />
                <p className="text-fg/60 text-[12px]">
                    Not a GitHub repository. Pull requests require a GitHub remote.
                </p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header: filter pills + search + refresh */}
            <div className="flex-shrink-0 border-b border-border">
                {/* Filter pills */}
                <div className="flex items-center gap-1 px-3 py-2">
                    {stateFilters.map((f) => (
                        <button
                            key={f.key}
                            className={`px-2.5 py-1 text-[11px] rounded-full transition-colors ${
                                stateFilter === f.key
                                    ? 'bg-accent text-white'
                                    : 'bg-hover text-fg/60 hover:text-fg hover:bg-hover/80'
                            }`}
                            onClick={() => handleFilterChange(f.key)}
                        >
                            {f.label}
                        </button>
                    ))}
                    <div className="flex-1" />
                    <button
                        className="p-1 text-fg/40 hover:text-fg transition-colors"
                        onClick={handleRefresh}
                        title="Refresh"
                    >
                        <RefreshCw size={13} />
                    </button>
                </div>

                {/* Search bar */}
                <div className="px-3 pb-2">
                    <div className="relative">
                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-fg/30" />
                        <input
                            type="text"
                            placeholder="Search PRs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-7 pr-2 py-1 text-[11px] bg-input border border-border rounded focus:border-accent focus:outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* PR List */}
            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8 text-fg/40 text-[11px]">
                        Loading pull requests…
                    </div>
                ) : prs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                        <p className="text-fg/40 text-[11px]">
                            {allPRs.length === 0
                                ? 'No pull requests found'
                                : `No PRs matching "${searchQuery}"`}
                        </p>
                    </div>
                ) : (
                    prs.map((pr) => {
                        const isSelected = selectedPRNumber === pr.number;
                        return (
                            <button
                                key={pr.number}
                                className={`w-full text-left px-3 py-2.5 border-b border-border transition-colors ${
                                    isSelected
                                        ? 'bg-accent/10 border-l-2 border-l-accent'
                                        : 'hover:bg-hover border-l-2 border-l-transparent'
                                }`}
                                onClick={() => handleSelectPR(pr.number)}
                            >
                                <div className="flex items-start gap-2">
                                    <div className="mt-0.5 flex-shrink-0">
                                        <StateIcon state={pr.state} isDraft={pr.isDraft} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-fg/40 text-[11px] flex-shrink-0">
                                                #{pr.number}
                                            </span>
                                            <span className="text-[12px] font-medium truncate">
                                                {pr.title}
                                            </span>
                                            {pr.isDraft && (
                                                <span className="text-[9px] px-1 py-0.5 bg-fg/10 text-fg/50 rounded flex-shrink-0">
                                                    Draft
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-fg/40">
                                            <span className="truncate">
                                                {pr.branch} → {pr.baseBranch}
                                            </span>
                                            <span>·</span>
                                            <span className="flex-shrink-0">
                                                {formatRelative(pr.updatedAt)}
                                            </span>
                                        </div>
                                        {pr.labels.length > 0 && (
                                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                                                {pr.labels.slice(0, 3).map((l) => (
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
                                    <div className="flex-shrink-0 flex items-center gap-1 text-[10px] text-fg/30">
                                        {pr.commentsCount > 0 && (
                                            <span title={`${pr.commentsCount} comments`}>
                                                💬 {pr.commentsCount}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
};
