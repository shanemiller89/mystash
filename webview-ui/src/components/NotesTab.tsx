import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNotesStore } from '../notesStore';
import { NotesList } from './NotesList';
import { NoteEditor } from './NoteEditor';

/** Breakpoint: below this the layout switches to narrow (replace) mode */
const NARROW_BREAKPOINT = 640;

export const NotesTab: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isNarrow, setIsNarrow] = useState(false);
    const selectedNoteId = useNotesStore((s) => s.selectedNoteId);
    const clearSelection = useNotesStore((s) => s.clearSelection);
    const isAuthenticated = useNotesStore((s) => s.isAuthenticated);

    // ResizeObserver for responsive layout
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setIsNarrow(entry.contentRect.width < NARROW_BREAKPOINT);
            }
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const handleCloseDetail = useCallback(() => {
        clearSelection();
    }, [clearSelection]);

    const hasSelection = selectedNoteId !== null;

    // Not authenticated — NotesList handles the sign-in prompt
    if (!isAuthenticated) {
        return (
            <div ref={containerRef} className="h-full bg-bg text-fg text-[13px]">
                <NotesList />
            </div>
        );
    }

    // Narrow mode: show either list OR editor (not both)
    if (isNarrow) {
        return (
            <div ref={containerRef} className="h-full bg-bg text-fg text-[13px]">
                {hasSelection ? (
                    <div className="h-full flex flex-col">
                        <div className="px-3 py-1.5 border-b border-border flex-shrink-0">
                            <button
                                className="text-[11px] text-accent hover:underline flex items-center gap-1"
                                onClick={handleCloseDetail}
                            >
                                ← Back to notes
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <NoteEditor onClose={handleCloseDetail} />
                        </div>
                    </div>
                ) : (
                    <NotesList />
                )}
            </div>
        );
    }

    // Wide mode: side-by-side 50/50
    return (
        <div ref={containerRef} className="h-full bg-bg text-fg text-[13px] flex">
            {/* Left pane — list */}
            <div
                className={`h-full overflow-hidden flex-shrink-0 transition-all duration-200 ${
                    hasSelection ? 'w-1/2 border-r border-border' : 'w-full'
                }`}
            >
                <NotesList />
            </div>

            {/* Right pane — editor */}
            {hasSelection && (
                <div className="w-1/2 h-full overflow-hidden">
                    <NoteEditor onClose={handleCloseDetail} />
                </div>
            )}
        </div>
    );
};
