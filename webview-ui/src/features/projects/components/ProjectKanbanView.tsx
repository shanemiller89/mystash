/**
 * ProjectKanbanView — Drag-and-drop Kanban board for GitHub Projects V2.
 *
 * Uses @atlaskit/pragmatic-drag-and-drop for card dragging.
 * Columns are fixed (ordering not supported via GitHub API public preview).
 * Card moves trigger optimistic updates + postMessage to the extension.
 *
 * Drop to `__none__` column → projects.clearField (clearProjectV2ItemFieldValue)
 * Drop to any other column  → projects.updateField (updateProjectV2ItemFieldValue)
 */
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    draggable,
    dropTargetForElements,
    monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import {
    attachClosestEdge,
    extractClosestEdge,
    type Edge,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { useProjectStore, type BoardColumn, type ProjectItemData } from '../store';
import { useNotesStore } from '@notes/store';
import { postMessage } from '@/vscode';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    CircleDot,
    CheckCircle2,
    GitPullRequest,
    GitMerge,
    StickyNote,
    Lock,
    GripVertical,
    ListTree,
    Link2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Symbol-keyed data for type-safe drop resolution ─────────────

const CARD_KEY = Symbol('kanban-card');
type CardDragData = {
    [CARD_KEY]: true;
    itemId: string;
    sourceColumnId: string;
};
function getCardData(itemId: string, sourceColumnId: string): CardDragData {
    return { [CARD_KEY]: true, itemId, sourceColumnId };
}
function isCardData(data: Record<string | symbol, unknown>): data is CardDragData {
    return data[CARD_KEY] === true;
}

// ─── GitHub Project color → CSS mapping ──────────────────────────

const GITHUB_COLOR_MAP: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    GRAY:   { bg: 'bg-[#8b8a8a20]', border: 'border-[#8b8a8a40]', text: 'text-[#8b8a8a]', dot: '#8b8a8a' },
    BLUE:   { bg: 'bg-[#58a6ff20]', border: 'border-[#58a6ff40]', text: 'text-[#58a6ff]', dot: '#58a6ff' },
    GREEN:  { bg: 'bg-[#3fb95020]', border: 'border-[#3fb95040]', text: 'text-[#3fb950]', dot: '#3fb950' },
    YELLOW: { bg: 'bg-[#d2992220]', border: 'border-[#d2992240]', text: 'text-[#d29922]', dot: '#d29922' },
    ORANGE: { bg: 'bg-[#db6d2820]', border: 'border-[#db6d2840]', text: 'text-[#db6d28]', dot: '#db6d28' },
    RED:    { bg: 'bg-[#f8514920]', border: 'border-[#f8514940]', text: 'text-[#f85149]', dot: '#f85149' },
    PINK:   { bg: 'bg-[#db61a220]', border: 'border-[#db61a240]', text: 'text-[#db61a2]', dot: '#db61a2' },
    PURPLE: { bg: 'bg-[#a371f720]', border: 'border-[#a371f740]', text: 'text-[#a371f7]', dot: '#a371f7' },
};

function getColumnColors(color?: string) {
    return GITHUB_COLOR_MAP[color ?? ''] ?? GITHUB_COLOR_MAP.GRAY;
}

// ─── ItemTypeIcon (shared visual) ────────────────────────────────

function ItemTypeIcon({ type, state, size = 14 }: { type: string; state?: string; size?: number }) {
    switch (type) {
        case 'ISSUE':
            return state === 'CLOSED'
                ? <CheckCircle2 size={size} className="text-purple-400" />
                : <CircleDot size={size} className="text-green-400" />;
        case 'PULL_REQUEST':
            if (state === 'MERGED') return <GitMerge size={size} className="text-purple-400" />;
            if (state === 'CLOSED') return <GitPullRequest size={size} className="text-red-400" />;
            return <GitPullRequest size={size} className="text-green-400" />;
        case 'DRAFT_ISSUE':
            return <StickyNote size={size} className="text-fg/50" />;
        case 'REDACTED':
            return <Lock size={size} className="text-fg/30" />;
        default:
            return <CircleDot size={size} className="text-fg/50" />;
    }
}

// ─── Drop Indicator ───────────────────────────────────────────────

function DropIndicatorLine({ edge }: { edge: Edge }) {
    return (
        <div
            className={cn(
                'absolute left-1 right-1 h-0.5 rounded-full bg-accent pointer-events-none z-10',
                edge === 'top' ? '-top-px' : '-bottom-px',
            )}
        />
    );
}

// ─── Kanban Card ─────────────────────────────────────────────────

type CardState =
    | { type: 'idle' }
    | { type: 'dragging' }
    | { type: 'over'; closestEdge: Edge | null };

const idleState: CardState = { type: 'idle' };
const draggingState: CardState = { type: 'dragging' };

interface KanbanCardProps {
    item: ProjectItemData;
    columnId: string;
    isSelected: boolean;
    onClick: () => void;
}

const KanbanCard: React.FC<KanbanCardProps> = React.memo(({ item, columnId, isSelected, onClick }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [state, setState] = useState<CardState>(idleState);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        return combine(
            draggable({
                element: el,
                getInitialData: () => getCardData(item.id, columnId),
                onDragStart: () => setState(draggingState),
                onDrop: () => setState(idleState),
            }),
            dropTargetForElements({
                element: el,
                canDrop: ({ source }) => isCardData(source.data) && source.data.itemId !== item.id,
                getData: ({ input }) =>
                    attachClosestEdge(getCardData(item.id, columnId), {
                        element: el,
                        input,
                        allowedEdges: ['top', 'bottom'],
                    }),
                onDragEnter: ({ self }) =>
                    setState({ type: 'over', closestEdge: extractClosestEdge(self.data) }),
                onDrag: ({ self }) =>
                    setState({ type: 'over', closestEdge: extractClosestEdge(self.data) }),
                onDragLeave: () => setState(idleState),
                onDrop: () => setState(idleState),
            }),
        );
    }, [item.id, columnId]);

    const title = item.content?.title ?? 'Untitled';
    const isDragging = state.type === 'dragging';
    const closestEdge = state.type === 'over' ? state.closestEdge : null;

    return (
        <div ref={ref} className="relative">
            {closestEdge === 'top' && <DropIndicatorLine edge="top" />}
            <button
                type="button"
                onClick={onClick}
                className={cn(
                    'w-full text-left rounded-md p-2.5 border transition-colors group',
                    isDragging && 'opacity-40',
                    isSelected
                        ? 'bg-accent/15 border-accent'
                        : 'bg-[var(--vscode-editor-background)] border-border hover:border-fg/20',
                )}
            >
                <div className="flex items-start gap-1.5">
                    {/* Drag handle */}
                    <div className="mt-0.5 shrink-0 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab active:cursor-grabbing">
                        <GripVertical size={12} />
                    </div>
                    <div className="mt-0.5 shrink-0">
                        <ItemTypeIcon type={item.type} state={item.content?.state} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                            {item.content?.number && (
                                <span className="text-fg/40 text-[10px] shrink-0">
                                    #{item.content.number}
                                </span>
                            )}
                            <span className="text-[11px] font-medium leading-snug line-clamp-2">
                                {title}
                            </span>
                        </div>
                        {item.content?.labels && item.content.labels.length > 0 && (
                            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                {item.content.labels.slice(0, 3).map((l) => (
                                    <Badge
                                        key={l.name}
                                        variant="outline"
                                        className="text-[8px] px-1 py-0"
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
                </div>
                <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[9px] text-fg/30 truncate">
                        {item.content?.author ?? ''}
                    </span>
                    {item.content?.assignees && item.content.assignees.length > 0 && (
                        <div className="shrink-0 flex -space-x-1">
                            {item.content.assignees.slice(0, 3).map((a) => (
                                <img
                                    key={a.login}
                                    src={a.avatarUrl}
                                    alt={a.login}
                                    title={a.login}
                                    className="w-3.5 h-3.5 rounded-full border border-bg"
                                />
                            ))}
                        </div>
                    )}
                </div>
                {/* Sub-issue progress bar */}
                {item.content?.subIssuesSummary && item.content.subIssuesSummary.total > 0 && (
                    <div className="mt-2 flex items-center gap-1.5">
                        <ListTree size={10} className="shrink-0 text-fg/40" />
                        <div className="flex-1 h-1.5 rounded-full bg-fg/10 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-[#3fb950] transition-all"
                                style={{ width: `${item.content.subIssuesSummary.percentCompleted}%` }}
                            />
                        </div>
                        <span className="text-[9px] text-fg/40 shrink-0 tabular-nums">
                            {item.content.subIssuesSummary.completed}/{item.content.subIssuesSummary.total}
                        </span>
                    </div>
                )}
                {/* Parent issue indicator */}
                {item.content?.parentIssue && (
                    <div className="mt-1.5 flex items-center gap-1 text-[9px] text-fg/30">
                        <Link2 size={9} className="shrink-0" />
                        <span className="truncate">
                            #{item.content.parentIssue.number} {item.content.parentIssue.title}
                        </span>
                    </div>
                )}
            </button>
            {closestEdge === 'bottom' && <DropIndicatorLine edge="bottom" />}
        </div>
    );
});

KanbanCard.displayName = 'KanbanCard';

// ─── Kanban Column ────────────────────────────────────────────────

type ColumnDropState = 'idle' | 'over';

interface KanbanColumnProps {
    column: BoardColumn;
    selectedItemId: string | null;
    onSelectItem: (itemId: string) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = React.memo(({ column, selectedItemId, onSelectItem }) => {
    const listRef = useRef<HTMLDivElement>(null);
    const [dropState, setDropState] = useState<ColumnDropState>('idle');
    const colors = getColumnColors(column.color);

    useEffect(() => {
        const el = listRef.current;
        if (!el) return;

        return dropTargetForElements({
            element: el,
            getData: () => ({ columnId: column.id }),
            canDrop: ({ source }) => isCardData(source.data) && source.data.sourceColumnId !== column.id,
            getIsSticky: () => true,
            onDragEnter: () => setDropState('over'),
            onDragLeave: () => setDropState('idle'),
            onDrop: () => setDropState('idle'),
        });
    }, [column.id]);

    const isOver = dropState === 'over';

    return (
        <div className="shrink-0 w-65 flex flex-col rounded-lg border border-border bg-[var(--vscode-sideBar-background)] overflow-clip">
            {/* Header */}
            <div className={cn('flex items-center gap-2 px-3 py-2 border-b border-border', colors.bg)}>
                <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: colors.dot }}
                />
                <span className={cn('text-[11px] font-semibold truncate', colors.text)}>
                    {column.name}
                </span>
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-auto">
                    {column.items.length}
                </Badge>
            </div>

            {/* Card list */}
            <ScrollArea className="flex-1 min-h-0">
                <div
                    ref={listRef}
                    className={cn(
                        'flex flex-col gap-1.5 p-2 min-h-16 transition-colors rounded-b-lg',
                        isOver && 'bg-accent/5',
                    )}
                >
                    {column.items.length === 0 ? (
                        <div className={cn(
                            'text-fg/20 text-[10px] text-center py-4 rounded border border-dashed transition-colors',
                            isOver ? 'border-accent/50 text-accent/50' : 'border-transparent',
                        )}>
                            {isOver ? 'Drop here' : 'No items'}
                        </div>
                    ) : (
                        column.items.map((item) => (
                            <KanbanCard
                                key={item.id}
                                item={item}
                                columnId={column.id}
                                isSelected={selectedItemId === item.id}
                                onClick={() => onSelectItem(item.id)}
                            />
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
});

KanbanColumn.displayName = 'KanbanColumn';

// ─── ProjectKanbanView ────────────────────────────────────────────

export const ProjectKanbanView: React.FC = () => {
    const selectedProject   = useProjectStore((s) => s.selectedProject);
    const fields            = useProjectStore((s) => s.fields);
    const rawItems          = useProjectStore((s) => s.items);
    const statusFilter      = useProjectStore((s) => s.statusFilter);
    const searchQuery       = useProjectStore((s) => s.searchQuery);
    const myIssuesOnly      = useProjectStore((s) => s.myIssuesOnly);
    const selectedViewId    = useProjectStore((s) => s.selectedViewId);
    const selectedItemId    = useProjectStore((s) => s.selectedItemId);
    const selectItem        = useProjectStore((s) => s.selectItem);
    const updateItemField   = useProjectStore((s) => s.updateItemFieldValue);
    const clearItemField    = useProjectStore((s) => s.clearItemFieldValue);
    const authUsername      = useNotesStore((s) => s.authUsername);

    // ── Derive board columns (same logic as store.boardColumns()) ──
    const { columns, groupField } = useMemo(() => {
        let filtered = rawItems.filter((i) => !i.isArchived);

        if (myIssuesOnly && authUsername) {
            filtered = filtered.filter((item) =>
                item.content?.assignees?.some(
                    (a) => a.login.toLowerCase() === authUsername.toLowerCase(),
                ),
            );
        }
        if (statusFilter !== 'all') {
            filtered = filtered.filter((item) => {
                const fv = item.fieldValues.find(
                    (fv) => fv.fieldName === 'Status' && fv.fieldType === 'SINGLE_SELECT',
                );
                return fv?.singleSelectOptionName === statusFilter;
            });
        }
        const q = searchQuery.trim().toLowerCase();
        if (q) {
            filtered = filtered.filter((item) => {
                const title  = item.content?.title?.toLowerCase() ?? '';
                const number = item.content?.number ? `#${item.content.number}` : '';
                const labels = item.content?.labels?.map((l) => l.name.toLowerCase()).join(' ') ?? '';
                return title.includes(q) || number.includes(q) || labels.includes(q);
            });
        }

        let groupByFieldId: string | undefined;
        if (selectedProject?.views) {
            const view = selectedViewId
                ? selectedProject.views.find((v) => v.id === selectedViewId)
                : selectedProject.views.find((v) => v.layout === 'BOARD');
            groupByFieldId = view?.groupByFieldIds?.[0];
        }

        let gf = groupByFieldId ? fields.find((f) => f.id === groupByFieldId) : undefined;
        if (!gf) {
            gf = fields.find((f) => f.name === 'Status' && f.dataType === 'SINGLE_SELECT');
        }

        if (!gf?.options) {
            return {
                columns: [{ id: '__all__', name: 'All Items', items: filtered }] as BoardColumn[],
                groupField: undefined,
            };
        }

        const cols: BoardColumn[] = [];
        const assigned = new Set<string>();

        for (const opt of gf.options) {
            const colItems = filtered.filter((item) => {
                const fv = item.fieldValues.find((v) => v.fieldId === gf!.id);
                return fv?.singleSelectOptionId === opt.id;
            });
            colItems.forEach((i) => assigned.add(i.id));
            cols.push({ id: opt.id, name: opt.name, color: opt.color, items: colItems });
        }

        const unassigned = filtered.filter((i) => !assigned.has(i.id));
        if (unassigned.length > 0) {
            cols.unshift({ id: '__none__', name: 'No ' + gf.name, items: unassigned });
        }

        return { columns: cols, groupField: gf };
    }, [rawItems, statusFilter, searchQuery, myIssuesOnly, authUsername, fields, selectedProject, selectedViewId]);

    // ── Register global drop monitor ──────────────────────────────
    useEffect(() => {
        return monitorForElements({
            canMonitor: ({ source }) => isCardData(source.data),
            onDrop({ source, location }) {
                if (!location.current.dropTargets.length) return;
                if (!isCardData(source.data)) return;

                const { itemId, sourceColumnId } = source.data;
                const projectId = selectedProject?.id;
                if (!projectId || !groupField) return;

                // Determine destination column — deepest drop target first (card), then column
                const [firstTarget, secondTarget] = location.current.dropTargets;

                let destColumnId: string | null = null;

                // If dropped onto a card, the second target is the column
                if (
                    firstTarget &&
                    isCardData(firstTarget.data) &&
                    typeof firstTarget.data.sourceColumnId === 'string'
                ) {
                    destColumnId = firstTarget.data.sourceColumnId;
                } else if (
                    secondTarget &&
                    typeof secondTarget.data.columnId === 'string'
                ) {
                    destColumnId = secondTarget.data.columnId;
                } else if (
                    firstTarget &&
                    typeof firstTarget.data.columnId === 'string'
                ) {
                    destColumnId = firstTarget.data.columnId;
                }

                if (!destColumnId || destColumnId === sourceColumnId) return;

                // ── Optimistic update ─────────────────────────────
                if (destColumnId === '__none__') {
                    // Clear the field — remove the fieldValue for this field
                    clearItemField(itemId, groupField.id);
                    // ── Persist ────────────────────────────────────
                    postMessage('projects.clearField', {
                        projectId,
                        itemId,
                        fieldId: groupField.id,
                    });
                } else {
                    // Find the option for the dest column
                    const option = groupField.options?.find((o) => o.id === destColumnId);
                    if (!option) return;

                    // Optimistic: update local field value
                    updateItemField(itemId, groupField.id, {
                        fieldId: groupField.id,
                        fieldName: groupField.name,
                        fieldType: 'SINGLE_SELECT',
                        singleSelectOptionId: option.id,
                        singleSelectOptionName: option.name,
                    });
                    // ── Persist ────────────────────────────────────
                    postMessage('projects.updateField', {
                        projectId,
                        itemId,
                        fieldId: groupField.id,
                        value: { singleSelectOptionId: option.id },
                    });
                }
            },
        });
    }, [selectedProject, groupField, updateItemField, clearItemField]);

    const handleSelectItem = useCallback((id: string) => selectItem(id), [selectItem]);

    if (columns.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-fg/40 text-[11px]">
                No columns to display
            </div>
        );
    }

    return (
        <div className="h-full overflow-x-auto">
            <div className="flex gap-3 p-3 h-full min-w-max">
                {columns.map((col) => (
                    <KanbanColumn
                        key={col.id}
                        column={col}
                        selectedItemId={selectedItemId}
                        onSelectItem={handleSelectItem}
                    />
                ))}
            </div>
        </div>
    );
};
