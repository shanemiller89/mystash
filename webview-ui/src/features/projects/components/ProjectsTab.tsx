import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useProjectStore } from '../store';
import { useNotesStore } from '@notes/store';
import { useAppStore } from '@/appStore';
import { postMessage } from '@/vscode';
import { ProjectList } from './ProjectList';
import { ProjectDetail } from './ProjectDetail';
import { ProjectKanbanView } from './ProjectKanbanView';
import { ProjectTableView } from './ProjectTableView';
import { ResizableLayout } from '@/components/shared/ResizableLayout';
import { TabWithSummary } from '@/components/shared/TabWithSummary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    LayoutGrid,
    Table,
    List,
    Kanban,
    Search,
    RefreshCw,
    ChevronDown,
    User,
    Building2,
    Filter,
    X,
} from 'lucide-react';

// Synthetic view id for the built-in simple list view
const SIMPLE_VIEW_ID = '__simple__';

// Layouts we can actually render — skip ROADMAP and any unsupported types
const SUPPORTED_LAYOUTS = new Set(['TABLE', 'BOARD']);

export const ProjectsTab: React.FC = () => {
    const selectedItemId = useProjectStore((s) => s.selectedItemId);
    const clearSelection = useProjectStore((s) => s.clearSelection);
    const selectedProject = useProjectStore((s) => s.selectedProject);
    const selectedViewId = useProjectStore((s) => s.selectedViewId);
    const setSelectedViewId = useProjectStore((s) => s.setSelectedViewId);
    const myIssuesOnly = useProjectStore((s) => s.myIssuesOnly);
    const setMyIssuesOnly = useProjectStore((s) => s.setMyIssuesOnly);
    const isAuthenticated = useNotesStore((s) => s.isAuthenticated);
    const authUsername = useNotesStore((s) => s.authUsername);
    const isRepoNotFound = useProjectStore((s) => s.isRepoNotFound);
    const isLoading = useProjectStore((s) => s.isLoading);
    const isItemsLoading = useProjectStore((s) => s.isItemsLoading);
    const availableProjects = useProjectStore((s) => s.availableProjects);
    const statusFilter = useProjectStore((s) => s.statusFilter);
    const setStatusFilter = useProjectStore((s) => s.setStatusFilter);
    const searchQuery = useProjectStore((s) => s.searchQuery);
    const setSearchQuery = useProjectStore((s) => s.setSearchQuery);
    const fields = useProjectStore((s) => s.fields);
    const orgLogin = useProjectStore((s) => s.orgLogin);
    const activeScope = useProjectStore((s) => s.activeScope);
    const setActiveScope = useProjectStore((s) => s.setActiveScope);
    const currentRepo = useAppStore((s) => s.currentRepo);

    const views = selectedProject?.views;

    // Split projects by scope
    const repoProjects = useMemo(
        () => availableProjects.filter((p) => p.ownerType !== 'org'),
        [availableProjects],
    );
    const orgProjects = useMemo(
        () => availableProjects.filter((p) => p.ownerType === 'org'),
        [availableProjects],
    );
    const hasOrgScope = orgLogin != null && orgProjects.length > 0;

    // Only show views whose layouts we can actually render
    const supportedViews = useMemo(
        () => (views ?? []).filter((v) => SUPPORTED_LAYOUTS.has(v.layout)),
        [views],
    );

    // Derive active view from raw data
    const currentView = useMemo(() => {
        if (!supportedViews.length) {
            return undefined;
        }
        if (selectedViewId && selectedViewId !== SIMPLE_VIEW_ID) {
            const found = supportedViews.find((v) => v.id === selectedViewId);
            if (found) {
                return found;
            }
        }
        return supportedViews[0];
    }, [supportedViews, selectedViewId]);

    const currentStatusOptions = useMemo(() => {
        const statusField = fields.find(
            (f) => f.name === 'Status' && f.dataType === 'SINGLE_SELECT',
        );
        return statusField?.options ?? [];
    }, [fields]);

    const handleCloseDetail = useCallback(() => {
        clearSelection();
    }, [clearSelection]);

    const handleRefresh = useCallback(() => {
        postMessage('projects.refresh');
    }, []);

    const handleProjectSwitch = useCallback((projectId: string) => {
        postMessage('projects.selectProject', { projectId });
    }, []);

    const handleScopeSwitch = useCallback(
        (scope: 'repo' | 'org') => {
            setActiveScope(scope);
            const pool = scope === 'org' ? orgProjects : repoProjects;
            if (pool.length > 0 && pool[0].id !== selectedProject?.id) {
                postMessage('projects.selectProject', { projectId: pool[0].id });
            }
        },
        [setActiveScope, orgProjects, repoProjects, selectedProject],
    );

    const hasSelection = selectedItemId !== null;
    const isSimple = selectedViewId === SIMPLE_VIEW_ID;
    const baseLayout = isSimple ? 'SIMPLE' : (currentView?.layout ?? 'TABLE');

    // Allow manually overriding the layout (List, Table, or Board)
    const [layoutOverride, setLayoutOverride] = useState<'SIMPLE' | 'TABLE' | 'BOARD' | null>(null);
    const layout = layoutOverride ?? baseLayout;
    const loading = isLoading || isItemsLoading;

    // Whether any filter is active
    const hasActiveFilter = statusFilter !== 'all' || myIssuesOnly;

    // Expandable filter row
    const [filtersOpen, setFiltersOpen] = useState(false);

    // Reset override when view changes
    useEffect(() => {
        setLayoutOverride(null);
    }, [selectedViewId]);

    // ─── Auth / repo-not-found guard ──────────────────────────────
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

    if (isRepoNotFound) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                <Kanban size={32} className="text-fg/30" />
                <p className="text-fg/60 text-[12px]">
                    Not a GitHub repository. Projects require a GitHub remote.
                </p>
                {orgLogin ? (
                    <>
                        <p className="text-fg/50 text-[11px]">
                            Org login <span className="font-mono text-fg/70">{orgLogin}</span> is configured.
                        </p>
                        <Button size="sm" onClick={handleRefresh} className="gap-1.5">
                            <Building2 size={13} />
                            Load org projects
                        </Button>
                    </>
                ) : (
                    <>
                        <p className="text-fg/50 text-[11px]">
                            Set an org login in Settings to load org-level project boards.
                        </p>
                        <Button
                            size="sm"
                            variant="secondary"
                            className="gap-1.5"
                            onClick={() => postMessage('settings.openInVSCode')}
                        >
                            Open Settings
                        </Button>
                    </>
                )}
            </div>
        );
    }

    // ─── Determine back label per layout ──────────────────────────
    const backLabel =
        layout === 'BOARD'
            ? 'Back to Board'
            : layout === 'TABLE'
              ? 'Back to Table'
              : 'Back to Project';

    // ─── Render view content (what goes in the list slot) ─────────
    const renderViewContent = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center h-full text-fg/40 text-[11px]">
                    Loading project items…
                </div>
            );
        }

        switch (layout) {
            case 'BOARD':
                return <ProjectKanbanView />;
            case 'TABLE':
                return <ProjectTableView />;
            case 'SIMPLE':
            default:
                return <ProjectList />;
        }
    };

    return (
        <TabWithSummary tabKey="projects">
            <div className="h-full flex flex-col">
                {/* ── Header ───────────────────────────────────────── */}
                <div className="shrink-0 border-b border-border">
                    {/* Row 1: Scope toggle (if org) + project selector + refresh */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5">
                        {hasOrgScope && (
                            <div className="flex items-center gap-0.5 shrink-0 border border-border rounded-md p-0.5 mr-0.5">
                                <Button
                                    variant={activeScope === 'repo' ? 'default' : 'ghost'}
                                    size="sm"
                                    className="h-auto px-1.5 py-0.5 text-[10px] gap-1 shrink-0"
                                    title="Repository projects"
                                    onClick={() => handleScopeSwitch('repo')}
                                >
                                    <Kanban size={11} />
                                    {activeScope === 'repo' && (
                                        <span className="truncate max-w-[80px]">{currentRepo?.repo ?? 'Repo'}</span>
                                    )}
                                </Button>
                                <Button
                                    variant={activeScope === 'org' ? 'default' : 'ghost'}
                                    size="sm"
                                    className="h-auto px-1.5 py-0.5 text-[10px] gap-1 shrink-0"
                                    title={`${orgLogin} org projectssssss`}
                                    onClick={() => handleScopeSwitch('org')}
                                >
                                    <Building2 size={11} />
                                    {activeScope === 'org' && (
                                        <span className="truncate max-w-[80px]">{orgLogin}</span>
                                    )}
                                </Button>
                            </div>
                        )}
                        <ProjectSelector
                            projects={
                                hasOrgScope
                                    ? activeScope === 'org'
                                        ? orgProjects
                                        : repoProjects
                                    : availableProjects
                            }
                            selectedId={selectedProject?.id ?? null}
                            onSelect={handleProjectSwitch}
                        />
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={handleRefresh}
                            title="Refresh"
                            className={loading ? 'animate-spin' : ''}
                        >
                            <RefreshCw size={13} />
                        </Button>
                    </div>

                    {/* Row 2: View tabs + layout toggle */}
                    {selectedProject && (
                        <div className="flex items-center gap-1.5 px-3 py-1 border-t border-border">
                            <div className="flex items-center gap-0.5 overflow-x-auto flex-1 min-w-0">
                                <ViewTab
                                    label="All"
                                    icon={<List size={11} />}
                                    isActive={selectedViewId === SIMPLE_VIEW_ID}
                                    onClick={() => setSelectedViewId(SIMPLE_VIEW_ID)}
                                />
                                {supportedViews.map((view) => (
                                    <ViewTab
                                        key={view.id}
                                        label={view.name}
                                        icon={<ViewLayoutIcon layout={view.layout} />}
                                        isActive={view.id === selectedViewId}
                                        onClick={() => setSelectedViewId(view.id)}
                                    />
                                ))}
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0 border border-border rounded-md p-0.5">
                                <Button
                                    variant={layout === 'SIMPLE' ? 'default' : 'ghost'}
                                    size="icon-xs"
                                    title="List view"
                                    onClick={() => setLayoutOverride('SIMPLE')}
                                >
                                    <List size={12} />
                                </Button>
                                <Button
                                    variant={layout === 'TABLE' ? 'default' : 'ghost'}
                                    size="icon-xs"
                                    title="Table view"
                                    onClick={() => setLayoutOverride('TABLE')}
                                >
                                    <Table size={12} />
                                </Button>
                                <Button
                                    variant={layout === 'BOARD' ? 'default' : 'ghost'}
                                    size="icon-xs"
                                    title="Kanban board"
                                    onClick={() => setLayoutOverride('BOARD')}
                                >
                                    <LayoutGrid size={12} />
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Row 3: Search + filter toggle */}
                    {selectedProject && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-border">
                            <div className="relative flex-1 min-w-0">
                                <Search
                                    size={12}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 text-fg/30"
                                />
                                <Input
                                    type="text"
                                    placeholder="Search items..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-7 h-7 text-[11px]"
                                />
                            </div>
                            {/* Board: inline My Issues toggle (board columns already act as status filter) */}
                            {layout === 'BOARD' && authUsername && (
                                <Button
                                    variant={myIssuesOnly ? 'default' : 'ghost'}
                                    size="sm"
                                    className="h-7 px-2 text-[10px] gap-1 shrink-0"
                                    onClick={() => setMyIssuesOnly(!myIssuesOnly)}
                                >
                                    <User size={10} />
                                    Mine
                                </Button>
                            )}
                            {/* Non-board: filter toggle button with active dot indicator */}
                            {layout !== 'BOARD' && (
                                <Button
                                    variant={filtersOpen ? 'default' : 'ghost'}
                                    size="icon-xs"
                                    onClick={() => setFiltersOpen(!filtersOpen)}
                                    title="Toggle filters"
                                    className="relative"
                                >
                                    <Filter size={13} />
                                    {hasActiveFilter && !filtersOpen && (
                                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-accent rounded-full" />
                                    )}
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Row 4 (conditional): Expanded filter pills */}
                    {filtersOpen && layout !== 'BOARD' && (
                        <div className="flex items-center gap-1 px-3 py-1.5 border-t border-border flex-wrap bg-[var(--vscode-sideBar-background)]">
                            <Button
                                variant={statusFilter === 'all' && !myIssuesOnly ? 'default' : 'secondary'}
                                size="sm"
                                className="h-auto px-2.5 py-1 text-[10px] rounded-full"
                                onClick={() => {
                                    setStatusFilter('all');
                                    setMyIssuesOnly(false);
                                }}
                            >
                                All
                            </Button>
                            {authUsername && (
                                <Button
                                    variant={myIssuesOnly ? 'default' : 'secondary'}
                                    size="sm"
                                    className="h-auto px-2.5 py-1 text-[10px] rounded-full gap-1"
                                    onClick={() => setMyIssuesOnly(!myIssuesOnly)}
                                >
                                    <User size={10} />
                                    My Issues
                                </Button>
                            )}
                            {currentStatusOptions.map((opt) => (
                                <Button
                                    key={opt.id}
                                    variant={statusFilter === opt.name ? 'default' : 'secondary'}
                                    size="sm"
                                    className="h-auto px-2.5 py-1 text-[10px] rounded-full"
                                    onClick={() => setStatusFilter(opt.name)}
                                >
                                    {opt.name}
                                </Button>
                            ))}
                            {hasActiveFilter && (
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    className="ml-auto"
                                    title="Clear all filters"
                                    onClick={() => {
                                        setStatusFilter('all');
                                        setMyIssuesOnly(false);
                                    }}
                                >
                                    <X size={12} />
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Active filter badges (when filter row is collapsed) */}
                    {!filtersOpen && hasActiveFilter && layout !== 'BOARD' && (
                        <div className="flex items-center gap-1 px-3 py-1 border-t border-border">
                            <span className="text-[9px] text-fg/40">Filtered:</span>
                            {myIssuesOnly && (
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 gap-1">
                                    <User size={8} />
                                    My Issues
                                    <button
                                        className="ml-0.5 hover:text-fg"
                                        onClick={() => setMyIssuesOnly(false)}
                                    >
                                        <X size={8} />
                                    </button>
                                </Badge>
                            )}
                            {statusFilter !== 'all' && (
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 gap-1">
                                    {statusFilter}
                                    <button
                                        className="ml-0.5 hover:text-fg"
                                        onClick={() => setStatusFilter('all')}
                                    >
                                        <X size={8} />
                                    </button>
                                </Badge>
                            )}
                        </div>
                    )}
                </div>

                {/* ── View content ──────────────────────────────────── */}
                <div className="flex-1 min-h-0">
                    {layout === 'BOARD' && !hasSelection ? (
                        renderViewContent()
                    ) : layout === 'SIMPLE' ? (
                        <ResizableLayout
                            storageKey="projects"
                            hasSelection={hasSelection}
                            backLabel={backLabel}
                            onBack={handleCloseDetail}
                            listContent={renderViewContent()}
                            detailContent={<ProjectDetail onClose={handleCloseDetail} />}
                        />
                    ) : (
                        <ResizableLayout
                            storageKey={`projects-${layout.toLowerCase()}`}
                            hasSelection={hasSelection}
                            backLabel={backLabel}
                            onBack={handleCloseDetail}
                            listContent={renderViewContent()}
                            detailContent={<ProjectDetail onClose={handleCloseDetail} />}
                        />
                    )}
                </div>
            </div>
        </TabWithSummary>
    );
};

// ─── Project Selector ─────────────────────────────────────────────

interface ProjectSelectorProps {
    projects: { id: string; title: string }[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({ projects, selectedId, onSelect }) => {
    if (projects.length === 0) {
        return <span className="text-[11px] text-fg/40 truncate flex-1">No projects</span>;
    }
    if (projects.length === 1) {
        return (
            <span className="text-[11px] font-medium truncate flex-1" title={projects[0].title}>
                {projects[0].title}
            </span>
        );
    }
    return (
        <div className="relative flex items-center flex-1 min-w-0">
            <select
                className="bg-transparent text-[11px] text-fg font-medium border-none outline-none cursor-pointer appearance-none flex-1 min-w-0 pr-4 truncate"
                value={selectedId ?? ''}
                onChange={(e) => onSelect(e.target.value)}
            >
                {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                        {p.title}
                    </option>
                ))}
            </select>
            <ChevronDown size={11} className="text-fg/30 absolute right-0 pointer-events-none" />
        </div>
    );
};

// ─── View Tab ─────────────────────────────────────────────────────

interface ViewTabProps {
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
}

const ViewTab: React.FC<ViewTabProps> = ({ label, icon, isActive, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={`shrink-0 flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
            isActive
                ? 'bg-accent/15 text-accent'
                : 'text-fg/50 hover:text-fg/70 hover:bg-fg/5'
        }`}
    >
        {icon}
        {label}
    </button>
);

// ─── View Layout Icon ─────────────────────────────────────────────

function ViewLayoutIcon({ layout }: { layout: string }) {
    switch (layout) {
        case 'BOARD':
            return <LayoutGrid size={11} />;
        case 'TABLE':
            return <Table size={11} />;
        default:
            return <List size={11} />;
    }
}
