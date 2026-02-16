import React, { useState, useCallback, useMemo } from 'react';
import { useProjectStore, type ProjectFieldValueData, type ProjectFieldData } from '../projectStore';
import { postMessage } from '../vscode';
import { MarkdownBody } from './MarkdownBody';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Input } from './ui/input';
import {
    CircleDot,
    CheckCircle2,
    GitPullRequest,
    GitMerge,
    StickyNote,
    ExternalLink,
    X,
    Trash2,
    Save,
    Edit2,
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
    size = 16,
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
        default:
            return <CircleDot size={size} className="text-fg/50" />;
    }
}

/** Editable field value component */
const FieldValueEditor: React.FC<{
    fieldValue: ProjectFieldValueData;
    fieldDef?: ProjectFieldData;
    onSave: (fieldId: string, value: Record<string, unknown>) => void;
}> = ({ fieldValue, fieldDef, onSave }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const isFieldUpdating = useProjectStore((s) => s.isFieldUpdating);

    const isEditable =
        fieldValue.fieldType === 'TEXT' ||
        fieldValue.fieldType === 'NUMBER' ||
        fieldValue.fieldType === 'DATE' ||
        fieldValue.fieldType === 'SINGLE_SELECT' ||
        fieldValue.fieldType === 'ITERATION';

    const startEdit = useCallback(() => {
        switch (fieldValue.fieldType) {
            case 'TEXT':
                setEditValue(fieldValue.text ?? '');
                break;
            case 'NUMBER':
                setEditValue(fieldValue.number !== undefined ? String(fieldValue.number) : '');
                break;
            case 'DATE':
                setEditValue(fieldValue.date ?? '');
                break;
            default:
                break;
        }
        setIsEditing(true);
    }, [fieldValue]);

    const handleSave = useCallback(() => {
        switch (fieldValue.fieldType) {
            case 'TEXT':
                onSave(fieldValue.fieldId, { text: editValue });
                break;
            case 'NUMBER':
                onSave(fieldValue.fieldId, { number: parseFloat(editValue) || 0 });
                break;
            case 'DATE':
                onSave(fieldValue.fieldId, { date: editValue });
                break;
            default:
                break;
        }
        setIsEditing(false);
    }, [fieldValue, editValue, onSave]);

    const handleSelectChange = useCallback(
        (optionId: string) => {
            onSave(fieldValue.fieldId, { singleSelectOptionId: optionId });
        },
        [fieldValue.fieldId, onSave],
    );

    const handleIterationChange = useCallback(
        (iterationId: string) => {
            onSave(fieldValue.fieldId, { iterationId });
        },
        [fieldValue.fieldId, onSave],
    );

    // Render display value
    const displayValue = useMemo(() => {
        switch (fieldValue.fieldType) {
            case 'TEXT':
                return fieldValue.text ?? '—';
            case 'NUMBER':
                return fieldValue.number !== undefined ? String(fieldValue.number) : '—';
            case 'DATE':
                return fieldValue.date ?? '—';
            case 'SINGLE_SELECT':
                return fieldValue.singleSelectOptionName ?? '—';
            case 'ITERATION':
                return fieldValue.iterationTitle ?? '—';
            case 'LABELS':
                return fieldValue.labels?.map((l) => l.name).join(', ') ?? '—';
            case 'ASSIGNEES':
                return fieldValue.users?.map((u) => u.login).join(', ') ?? '—';
            case 'MILESTONE':
                return fieldValue.milestoneTitle ?? '—';
            default:
                return '—';
        }
    }, [fieldValue]);

    // SINGLE_SELECT: inline dropdown
    if (fieldValue.fieldType === 'SINGLE_SELECT' && fieldDef?.options) {
        return (
            <select
                className="bg-transparent text-[11px] text-fg border border-border rounded px-1.5 py-0.5 cursor-pointer"
                value={fieldValue.singleSelectOptionId ?? ''}
                onChange={(e) => handleSelectChange(e.target.value)}
                disabled={isFieldUpdating}
            >
                <option value="">None</option>
                {fieldDef.options.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                        {opt.name}
                    </option>
                ))}
            </select>
        );
    }

    // ITERATION: inline dropdown
    if (fieldValue.fieldType === 'ITERATION' && fieldDef?.iterations) {
        return (
            <select
                className="bg-transparent text-[11px] text-fg border border-border rounded px-1.5 py-0.5 cursor-pointer"
                value={fieldValue.iterationId ?? ''}
                onChange={(e) => handleIterationChange(e.target.value)}
                disabled={isFieldUpdating}
            >
                <option value="">None</option>
                {fieldDef.iterations.map((iter) => (
                    <option key={iter.id} value={iter.id}>
                        {iter.title}
                    </option>
                ))}
            </select>
        );
    }

    // TEXT / NUMBER / DATE: click-to-edit
    if (isEditable && isEditing) {
        return (
            <div className="flex items-center gap-1">
                <Input
                    type={
                        fieldValue.fieldType === 'NUMBER'
                            ? 'number'
                            : fieldValue.fieldType === 'DATE'
                              ? 'date'
                              : 'text'
                    }
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-6 text-[11px] px-1.5 w-32"
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            handleSave();
                        }
                        if (e.key === 'Escape') {
                            setIsEditing(false);
                        }
                    }}
                />
                <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleSave}
                    disabled={isFieldUpdating}
                >
                    <Save size={11} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setIsEditing(false)}
                >
                    <X size={11} />
                </Button>
            </div>
        );
    }

    // Read-only or click-to-edit display
    return (
        <div className="flex items-center gap-1 group">
            <span className="text-[11px]">{displayValue}</span>
            {isEditable && (
                <Button
                    variant="ghost"
                    size="icon-xs"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={startEdit}
                    title="Edit"
                >
                    <Edit2 size={10} />
                </Button>
            )}
        </div>
    );
};

interface ProjectDetailProps {
    onClose: () => void;
}

export const ProjectDetail: React.FC<ProjectDetailProps> = ({ onClose }) => {
    const selectedItemId = useProjectStore((s) => s.selectedItemId);
    const items = useProjectStore((s) => s.items);
    const fields = useProjectStore((s) => s.fields);
    const selectedProject = useProjectStore((s) => s.selectedProject);

    const item = useMemo(() => {
        if (!selectedItemId) {
            return undefined;
        }
        return items.find((i) => i.id === selectedItemId);
    }, [items, selectedItemId]);

    const handleFieldSave = useCallback(
        (fieldId: string, value: Record<string, unknown>) => {
            if (!item || !selectedProject) {
                return;
            }
            postMessage('projects.updateField', {
                projectId: selectedProject.id,
                itemId: item.id,
                fieldId,
                value,
            });
        },
        [item, selectedProject],
    );

    const handleDelete = useCallback(() => {
        if (!item || !selectedProject) {
            return;
        }
        postMessage('projects.deleteItem', {
            projectId: selectedProject.id,
            itemId: item.id,
        });
    }, [item, selectedProject]);

    const handleOpenInBrowser = useCallback(() => {
        if (item?.content?.url) {
            postMessage('projects.openInBrowser', { url: item.content.url });
        } else if (selectedProject?.url) {
            postMessage('projects.openInBrowser', { url: selectedProject.url });
        }
    }, [item, selectedProject]);

    if (!item) {
        return (
            <div className="h-full flex items-center justify-center text-fg/30 text-[11px]">
                Select an item to view details
            </div>
        );
    }

    const title = item.content?.title ?? 'Untitled';
    const fieldDefsMap = new Map(fields.map((f) => [f.id, f]));

    // Separate editable project fields from read-only content fields
    const editableFields = item.fieldValues.filter(
        (fv) =>
            fv.fieldType === 'TEXT' ||
            fv.fieldType === 'NUMBER' ||
            fv.fieldType === 'DATE' ||
            fv.fieldType === 'SINGLE_SELECT' ||
            fv.fieldType === 'ITERATION',
    );

    const readOnlyFields = item.fieldValues.filter(
        (fv) =>
            fv.fieldType === 'LABELS' ||
            fv.fieldType === 'ASSIGNEES' ||
            fv.fieldType === 'MILESTONE',
    );

    return (
        <div className="h-full flex flex-col overflow-y-auto">
            {/* Header */}
            <div className="shrink-0 p-4 border-b border-border">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                        <div className="mt-0.5 shrink-0">
                            <ItemTypeIcon type={item.type} state={item.content?.state} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-[14px] font-semibold leading-snug">
                                {item.content?.number && (
                                    <span className="text-fg/40 font-normal">
                                        #{item.content.number}{' '}
                                    </span>
                                )}
                                {title}
                            </h2>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-fg/40">
                                {item.content?.author && (
                                    <div className="flex items-center gap-1">
                                        {item.content.authorAvatarUrl && (
                                            <img
                                                src={item.content.authorAvatarUrl}
                                                alt={item.content.author}
                                                className="w-3.5 h-3.5 rounded-full"
                                            />
                                        )}
                                        <span>{item.content.author}</span>
                                    </div>
                                )}
                                <span>·</span>
                                <span>updated {formatRelative(item.updatedAt)}</span>
                                {item.content?.state && (
                                    <>
                                        <span>·</span>
                                        <Badge
                                            variant={
                                                item.content.state === 'OPEN'
                                                    ? 'success'
                                                    : item.content.state === 'MERGED'
                                                      ? 'default'
                                                      : 'secondary'
                                            }
                                            className="text-[9px] px-1.5 py-0"
                                        >
                                            {item.content.state}
                                        </Badge>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={handleOpenInBrowser}
                            title="Open in Browser"
                        >
                            <ExternalLink size={13} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={handleDelete}
                            title="Remove from Project"
                            className="text-destructive hover:text-destructive"
                        >
                            <Trash2 size={13} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={onClose}
                            title="Close"
                        >
                            <X size={13} />
                        </Button>
                    </div>
                </div>

                {/* Labels */}
                {item.content?.labels && item.content.labels.length > 0 && (
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                        {item.content.labels.map((l) => (
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

                {/* Assignees */}
                {item.content?.assignees && item.content.assignees.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2">
                        {item.content.assignees.map((a) => (
                            <div key={a.login} className="flex items-center gap-1">
                                <img
                                    src={a.avatarUrl}
                                    alt={a.login}
                                    className="w-4 h-4 rounded-full"
                                />
                                <span className="text-[10px] text-fg/50">{a.login}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Project Fields */}
            {(editableFields.length > 0 || readOnlyFields.length > 0) && (
                <div className="shrink-0 border-b border-border">
                    <div className="px-4 py-3">
                        <h3 className="text-[11px] font-semibold text-fg/60 uppercase tracking-wide mb-2">
                            Project Fields
                        </h3>
                        <div className="space-y-2">
                            {editableFields.map((fv) => (
                                <div
                                    key={fv.fieldId}
                                    className="flex items-center justify-between gap-2"
                                >
                                    <span className="text-[11px] text-fg/50 shrink-0">
                                        {fv.fieldName}
                                    </span>
                                    <FieldValueEditor
                                        fieldValue={fv}
                                        fieldDef={fieldDefsMap.get(fv.fieldId)}
                                        onSave={handleFieldSave}
                                    />
                                </div>
                            ))}
                            {readOnlyFields.map((fv) => {
                                let display: React.ReactNode = '—';
                                if (
                                    fv.fieldType === 'LABELS' &&
                                    fv.labels &&
                                    fv.labels.length > 0
                                ) {
                                    display = (
                                        <div className="flex items-center gap-1 flex-wrap">
                                            {fv.labels.map((l) => (
                                                <Badge
                                                    key={l.name}
                                                    variant="outline"
                                                    className="text-[9px] px-1 py-0"
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
                                    );
                                } else if (
                                    fv.fieldType === 'ASSIGNEES' &&
                                    fv.users &&
                                    fv.users.length > 0
                                ) {
                                    display = fv.users.map((u) => u.login).join(', ');
                                } else if (fv.fieldType === 'MILESTONE' && fv.milestoneTitle) {
                                    display = fv.milestoneTitle;
                                }

                                return (
                                    <div
                                        key={fv.fieldId}
                                        className="flex items-center justify-between gap-2"
                                    >
                                        <span className="text-[11px] text-fg/50 shrink-0">
                                            {fv.fieldName}
                                        </span>
                                        <span className="text-[11px]">{display}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            <Separator />

            {/* Body */}
            <div className="flex-1 p-4">
                {item.content?.body ? (
                    <MarkdownBody content={item.content.body} />
                ) : (
                    <p className="text-fg/30 text-[11px] italic">No description provided.</p>
                )}
            </div>
        </div>
    );
};
