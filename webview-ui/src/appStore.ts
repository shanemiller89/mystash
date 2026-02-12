import { create } from 'zustand';

/** App-level UI state shared across tabs */
interface AppStore {
    activeTab: 'stashes' | 'notes';
    setActiveTab: (tab: 'stashes' | 'notes') => void;
    /** Deep-link: note ID to open when switching to notes tab */
    pendingNoteId: string | null;
    setPendingNoteId: (id: string | null) => void;
}

export const useAppStore = create<AppStore>((set) => ({
    activeTab: 'stashes',
    setActiveTab: (activeTab) => set({ activeTab }),
    pendingNoteId: null,
    setPendingNoteId: (pendingNoteId) => set({ pendingNoteId }),
}));
