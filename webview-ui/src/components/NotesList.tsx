import React, { useRef, useCallback, useState } from 'react';
import { useNotesStore, type GistNoteData } from '../notesStore';
import { postMessage } from '../vscode';
import { Lock, Globe, StickyNote, Plus, X, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Skeleton } from './ui/skeleton';

/** Skeleton card shown while notes are loading */
const SkeletonCard: React.FC = () => (
    <div className="rounded-md border border-border bg-card p-3">
        <div className="space-y-2">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2 w-1/2" />
        </div>
    </div>
);

export const NotesList: React.FC = () => {
    const isLoading = useNotesStore((s) => s.isLoading);
    const isAuthenticated = useNotesStore((s) => s.isAuthenticated);
    const searchQuery = useNotesStore((s) => s.searchQuery);
    const setSearchQuery = useNotesStore((s) => s.setSearchQuery);
    const notes = useNotesStore((s) => s.filteredNotes());
    const allNotes = useNotesStore((s) => s.notes);
    const selectedNoteId = useNotesStore((s) => s.selectedNoteId);
    const selectNote = useNotesStore((s) => s.selectNote);
    const isDirty = useNotesStore((s) => s.isDirty);
    const searchRef = useRef<HTMLInputElement>(null);
    const [creatingNote, setCreatingNote] = useState(false);
    const [newNoteTitle, setNewNoteTitle] = useState('');
    const [newNotePublic, setNewNotePublic] = useState(false);
    const newNoteTitleRef = useRef<HTMLInputElement>(null);

    const handleSelectNote = useCallback(
        (note: GistNoteData) => {
            if (isDirty) {
                // Post to extension for VS Code-style confirmation
                postMessage('notes.confirmDirtySwitch', { targetNoteId: note.id });
            } else {
                selectNote(note.id);
            }
        },
        [isDirty, selectNote],
    );

    const handleCreateNote = useCallback(() => {
        setCreatingNote(true);
        setNewNoteTitle('');
        setNewNotePublic(false);
        setTimeout(() => newNoteTitleRef.current?.focus(), 50);
    }, []);

    const handleSubmitCreate = useCallback(() => {
        const title = newNoteTitle.trim() || 'Untitled Note';
        postMessage('notes.create', { title, content: '', isPublic: newNotePublic });
        setCreatingNote(false);
        setNewNoteTitle('');
    }, [newNoteTitle, newNotePublic]);

    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setSearchQuery('');
            searchRef.current?.blur();
        }
    };

    // Not authenticated state
    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-4">
                <ShieldCheck size={32} className="opacity-60" />
                <div className="space-y-2">
                    <div className="text-[13px] font-medium">Sign in to GitHub</div>
                    <div className="text-[11px] opacity-60 leading-relaxed">
                        Gist Notes uses GitHub Gists to store your Markdown notes. Sign in to sync
                        across devices.
                    </div>
                </div>
                <Button
                    onClick={() => postMessage('notes.signIn')}
                >
                    Sign In to GitHub
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header with search + create */}
            <div className="px-3 py-2 border-b border-border flex-shrink-0 space-y-2">
                <div className="flex items-center gap-2">
                    <Input
                        ref={searchRef}
                        type="text"
                        placeholder="Search notes…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        className="flex-1 text-[12px]"
                    />
                    <Button
                        size="sm"
                        className="h-auto px-2.5 py-1 text-[11px] flex-shrink-0 gap-1"
                        onClick={handleCreateNote}
                        title="Create new note"
                    >
                        <Plus size={12} /> New
                    </Button>
                </div>

                {/* Inline create form */}
                {creatingNote && (
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                            <Input
                                ref={newNoteTitleRef}
                                type="text"
                                placeholder="Note title…"
                                value={newNoteTitle}
                                onChange={(e) => setNewNoteTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSubmitCreate();
                                    if (e.key === 'Escape') setCreatingNote(false);
                                }}
                                className="flex-1 text-[12px]"
                            />
                            <Button
                                size="sm"
                                className="h-auto px-2 py-1 text-[11px]"
                                onClick={handleSubmitCreate}
                            >
                                Create
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => setCreatingNote(false)}
                            >
                                <X size={12} />
                            </Button>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant={!newNotePublic ? 'default' : 'ghost'}
                                size="sm"
                                className="h-auto px-2 py-0.5 text-[11px] gap-1"
                                onClick={() => setNewNotePublic(false)}
                            >
                                <Lock size={11} />
                                Secret
                            </Button>
                            <Button
                                variant={newNotePublic ? 'default' : 'ghost'}
                                size="sm"
                                className="h-auto px-2 py-0.5 text-[11px] gap-1"
                                onClick={() => setNewNotePublic(true)}
                            >
                                <Globe size={11} />
                                Public
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Note list */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
                {isLoading ? (
                    <>
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                    </>
                ) : notes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center opacity-50 gap-2 py-8">
                        <StickyNote size={24} className="opacity-60" />
                        <span className="text-[12px]">
                            {searchQuery
                                ? 'No notes match your search'
                                : 'No notes yet — create one to get started'}
                        </span>
                    </div>
                ) : (
                    notes.map((note) => {
                        const isSelected = selectedNoteId === note.id;
                        const snippet = note.content.replace(/\n/g, ' ').slice(0, 80);
                        const updatedDate = new Date(note.updatedAt);
                        const timeAgo = formatRelativeTimeSimple(updatedDate);

                        return (
                            <div
                                key={note.id}
                                className={`rounded-md border p-2.5 cursor-pointer transition-colors ${
                                    isSelected
                                        ? 'border-accent ring-1 ring-accent bg-accent/5'
                                        : 'border-border bg-card hover:border-accent'
                                }`}
                                onClick={() => handleSelectNote(note)}
                                role="option"
                                aria-selected={isSelected}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-[13px] truncate">
                                            {note.title || 'Untitled'}
                                        </div>
                                        <div className="text-[11px] opacity-50 truncate mt-0.5">
                                            {snippet || 'Empty note'}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                                        <span className="text-[10px] opacity-40">{timeAgo}</span>
                                        <span
                                            className="text-[10px]"
                                            title={note.isPublic ? 'Public' : 'Secret'}
                                        >
                                            {note.isPublic ? (
                                                <Globe size={12} />
                                            ) : (
                                                <Lock size={12} />
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer */}
            <div className="px-3 py-1.5 border-t border-border text-[10px] opacity-40 flex-shrink-0">
                {allNotes.length} note{allNotes.length !== 1 ? 's' : ''}
            </div>
        </div>
    );
};

/** Simple relative time formatter for the webview (avoids importing the full utils) */
function formatRelativeTimeSimple(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString();
}
