import React, { useCallback } from 'react';
import { useNotesStore } from '../notesStore';
import { NotesList } from './NotesList';
import { NoteEditor } from './NoteEditor';
import { ResizableLayout } from './ResizableLayout';
import { TabWithSummary } from './TabWithSummary';

export const NotesTab: React.FC = () => {
    const selectedNoteId = useNotesStore((s) => s.selectedNoteId);
    const clearSelection = useNotesStore((s) => s.clearSelection);
    const isAuthenticated = useNotesStore((s) => s.isAuthenticated);

    const handleCloseDetail = useCallback(() => {
        clearSelection();
    }, [clearSelection]);

    const hasSelection = selectedNoteId !== null;

    // Not authenticated — NotesList handles the sign-in prompt
    if (!isAuthenticated) {
        return (
            <div className="h-full bg-bg text-fg text-[13px]">
                <NotesList />
            </div>
        );
    }

    return (
        <TabWithSummary tabKey="notes">
            <ResizableLayout
                storageKey="notes"
                hasSelection={hasSelection}
                backLabel="Back to notes"
                onBack={handleCloseDetail}
                listContent={<NotesList />}
                detailContent={<NoteEditor onClose={handleCloseDetail} />}
            />
        </TabWithSummary>
    );
};
