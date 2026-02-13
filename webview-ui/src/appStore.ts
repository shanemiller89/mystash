import { create } from 'zustand';

/** App-level UI state shared across tabs */
interface AppStore {
    activeTab: 'stashes' | 'notes' | 'prs';
    setActiveTab: (tab: 'stashes' | 'notes' | 'prs') => void;
    /** Deep-link: note ID to open when switching to notes tab */
    pendingNoteId: string | null;
    setPendingNoteId: (id: string | null) => void;
    /** Deep-link: PR number to open when switching to prs tab */
    pendingPRNumber: number | null;
    setPendingPRNumber: (num: number | null) => void;
}

export const useAppStore = create<AppStore>((set) => ({
    activeTab: 'stashes',
    setActiveTab: (activeTab) => set({ activeTab }),
    pendingNoteId: null,
    setPendingNoteId: (pendingNoteId) => set({ pendingNoteId }),
    pendingPRNumber: null,
    setPendingPRNumber: (pendingPRNumber) => set({ pendingPRNumber }),
}));
