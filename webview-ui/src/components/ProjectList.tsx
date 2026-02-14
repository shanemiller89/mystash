import React, { useCallback, useMemo } from 'react';
import { useProjectStore } from '../projectStore';
import { useNotesStore } from '../notesStore';
import { postMessage } from '../vscode';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import {
    Kanban,
    Search,
    RefreshCw,
    CircleDot,
    CheckCircle2,
    GitPullRequest,
    GitMerge,
    StickyNote,
    Lock,
    ChevronDown,
} from 'lucide-react';

function formatRelative(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) {
        return 'just now';
    }
    if (diffMins < 60) {
        return `${diffMins}m ago`;
    }
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
        return `${diffHours}h ago`;
    }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) {
        return `${diffDays}d ago`;
    }
    return date.toLocaleDateString();
}

function ItemTypeIcon({
    type,
    state,
    size = 14,
}: {
    type: string;
    state?: string;
    size?: number;
}) {
    switch (type) {
        case 'ISSUE':
            if (state === 'CLOSED') {
                return <CheckCircle2 size={size} className="text-purple-400" />;
            }
            return <CircleDot size={size} className="text-green-400" />;
        case 'PULL_REQUEST':
            if (state === 'MERGED') {
                return <GitMerge size={size} className="text-purple-400" />;
            }
            if (state === 'CLOSED') {
                return <GitPullRequest size={size} className="text-red-400" />;
            }
            return <GitPullRequest size={size} className="text-green-400" />;
        case 'DRAFT_ISSUE':
            return <StickyNote size={size} className="text-fg/50" />;
        case 'REDACTED':
            return <Lock size={size} className="text-fg/30" />;
        default:
            return <CircleDot size={size} className="text-fg/50" />;
    }
}

export const ProjectList: React.FC = () => {
    const items = useProjectStore((s) => s.items);
    const searchQuery = useProjectStore((s) => s.searchQuery);
    const isLoading = useProjectStore((s) => s.isLoading);
    const isItemsLoading = useProjectStore((s) => s.isItemsLoading);
    const isRepoNotFound = useProjectStore((s) => s.isRepoNotFound);
    const statusFilter = useProjectStore((s) => s.statusFilter);
    const setStatusFilter = useProjectStore((s) => s.setStatusFilter);
    const selectItem = useProjectStore((s) => s.selectItem);
    const selectedItemId = useProjectStore((s) => s.selectedItemId);
    const setSearchQuery = useProjectStore((s) => s.setSearchQuery);
    const availableProjects = useProjectStore((s) => s.availableProjects);
    const selectedProject = useProjectStore((s) => s.selectedProject);
    const statusOptions = useProjectStore((s) => s.statusOptions);
    const isAuthenticated = useNotesStore((s) => s.isAuthenticated);

    const filteredItems = useMemo(() => {
        let filtered = items.filter((i) => !i.isArchived);

        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter((item) => {
                const statusFv = item.fieldValues.find(
                    (fv) => fv.fieldName === 'Status' && fv.fieldType === 'SINGLE_SELECT',
                );
                return statusFv?.singleSelectOptionName === statusFilter;
            });
        }

        // Search filter
        const q = searchQuery.trim().toLowerCase();
        if (q) {
            filtered = filtered.filter((item) => {
                const title = item.content?.title?.toLowerCase() ?? '';
                const number = item.content?.number ? `#${item.content.number}` : '';
                const labels =
                    item.content?.labels?.map((l) => l.name.toLowerCase()).join(' ') ?? '';
                return title.includes(q) || number.includes(q) || labels.includes(q);
            });
        }

        return filtered;
    }, [items, statusFilter, searchQuery]);

    const handleRefresh = useCallback(() => {
        postMessage('projects.refresh');
    }, []);

    const handleSelectItem = useCallback(
        (itemId: string) => {
            selectItem(itemId);
        },
        [selectItem],
    );

    const handleProjectSwitch = useCallback(
        (projectId: string) => {
            postMessage('projects.selectProject', { projectId });
        },
        [],
    );

    const currentStatusOptions = useMemo(() => statusOptions(), [statusOptions]);

    // Not authenticated
    if (!isAuthenticated) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                <Kanban size={32} className="text-fg/30" />
                <p className="text-fg/60 text-[12px]">
                    Sign in to GitHub to see your projects.
                </p>
                <Button onClick={() => postMessage('projects.signIn')}>
                    Sign In to GitHub
                </Button>
            </div>
        );
    }

    // Not a GitHub repo
    if (isRepoNotFound) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                <Kanban size={32} className="text-fg/30" />
                <p className="text-fg/60 text-[12px]">
                    Not a GitHub repository. Projects require a GitHub remote.
                </p>
            </div>
        );
    }

    const loading = isLoading || isItemsLoading;

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-border">
                {/* Project selector */}
                {availableProjects.length > 1 && (
                    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border">
                        <span className="text-[10px] text-fg/40">Project:</span>
                        <select
                            className="bg-transparent text-[11px] text-fg border-none outline-none cursor-pointer flex-1 min-w-0"
                            value={selectedProject?.id ?? ''}
                            onChange={(e) => handleProjectSwitch(e.target.value)}
                        >
                            {availableProjects.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.title}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={11} className="text-fg/30" />
                    </div>
                )}

                {/* Status filter pills */}
                <div className="flex items-center gap-1 px-3 py-2 flex-wrap">
                    <Button
                        variant={statusFilter === 'all' ? 'default' : 'secondary'}
                        size="sm"
                        className="h-auto px-2.5 py-1 text-[11px] rounded-full"
                        onClick={() => setStatusFilter('all')}
                    >
                        All
                    </Button>
                    {currentStatusOptions.map((opt) => (
                        <Button
                            key={opt.id}
                            variant={statusFilter === opt.name ? 'default' : 'secondary'}
                            size="sm"
                            className="h-auto px-2.5 py-1 text-[11px] rounded-full"
                            onClick={() => setStatusFilter(opt.name)}
                        >
                            {opt.name}
                        </Button>
                    ))}
                    <div className="flex-1" />
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={handleRefresh}
                        title="Refresh"
                    >
                        <RefreshCw size={13} />
                    </Button>
                </div>

                {/* Search bar */}
                <div className="px-3 pb-2">
                    <div className="relative">
                        <Search
                            size={12}
                            className="absolute left-2 top-1/2 -translate-y-1/2 text-fg/30"
                        />
                        <Input
                            type="text"
                            placeholder="Search items..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-7 text-[11px]"
                        />
                    </div>
                </div>
            </div>

            {/* Item List */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-8 text-fg/40 text-[11px]">
                        Loading project items…
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                        <p className="text-fg/40 text-[11px]">
                            {items.length === 0
                                ? selectedProject
                                    ? 'No items in this project'
                                    : 'No projects found for this repository'
                                : `No items matching "${searchQuery}"`}
                        </p>
                    </div>
                ) : (
                    filteredItems.map((item) => {
                        const isSelected = selectedItemId === item.id;
                        const title = item.content?.title ?? 'Untitled';
                        const statusFv = item.fieldValues.find(
                            (fv) =>
                                fv.fieldName === 'Status' &&
                                fv.fieldType === 'SINGLE_SELECT',
                        );

                        return (
                            <Button
                                key={item.id}
                                variant="ghost"
                                className={`w-full justify-start h-auto px-3 py-2.5 rounded-none border-b border-border ${
                                    isSelected
                                        ? 'bg-accent/10 border-l-2 border-l-accent'
                                        : 'border-l-2 border-l-transparent'
                                }`}
                                onClick={() => handleSelectItem(item.id)}
                            >
                                <div className="flex items-start gap-2">
                                    <div className="mt-0.5 flex-shrink-0">
                                        <ItemTypeIcon
                                            type={item.type}
                                            state={item.content?.state}
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            {item.content?.number && (
                                                <span className="text-fg/40 text-[11px] flex-shrink-0">
                                                    #{item.content.number}
                                                </span>
                                            )}
                                            <span className="text-[12px] font-medium truncate">
                                                {title}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-fg/40">
                                            {item.content?.author && (
                                                <span className="truncate">
                                                    by {item.content.author}
                                                </span>
                                            )}
                                            {statusFv?.singleSelectOptionName && (
                                                <>
                                                    <span>·</span>
                                                    <span className="flex-shrink-0">
                                                        {statusFv.singleSelectOptionName}
                                                    </span>
                                                </>
                                            )}
                                            <span>·</span>
                                            <span className="flex-shrink-0">
                                                {formatRelative(item.updatedAt)}
                                            </span>
                                        </div>
                                        {item.content?.labels &&
                                            item.content.labels.length > 0 && (
                                                <div className="flex items-center gap-1 mt-1 flex-wrap">
                                                    {item.content.labels.slice(0, 4).map((l) => (
                                                        <Badge
                                                            key={l.name}
                                                            variant="outline"
                                                            className="text-[9px] px-1.5 py-0.5"
                                                            style={{
                                                                backgroundColor: `#${l.color}20`,
                                                                color: `#${l.color}`,
                                                                borderColor: `#${l.color}40`,
                                                            }}
                                                        >
                                                            {l.name}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                    </div>
                                    {item.content?.assignees &&
                                        item.content.assignees.length > 0 && (
                                            <div className="flex-shrink-0 flex -space-x-1">
                                                {item.content.assignees.slice(0, 3).map((a) => (
                                                    <img
                                                        key={a.login}
                                                        src={a.avatarUrl}
                                                        alt={a.login}
                                                        title={a.login}
                                                        className="w-4 h-4 rounded-full border border-bg"
                                                    />
                                                ))}
                                            </div>
                                        )}
                                </div>
                            </Button>
                        );
                    })
                )}
            </div>
        </div>
    );
};
