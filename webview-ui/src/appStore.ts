import { create } from 'zustand';

/** App-level UI state shared across tabs */
interface AppStore {
    activeTab: 'stashes' | 'notes' | 'prs' | 'issues' | 'mattermost';
    setActiveTab: (tab: 'stashes' | 'notes' | 'prs' | 'issues' | 'mattermost') => void;
    /** Deep-link: note ID to open when switching to notes tab */
    pendingNoteId: string | null;
    setPendingNoteId: (id: string | null) => void;
    /** Deep-link: PR number to open when switching to prs tab */
    pendingPRNumber: number | null;
    setPendingPRNumber: (num: number | null) => void;
    /** Deep-link: Issue number to open when switching to issues tab */
    pendingIssueNumber: number | null;
    setPendingIssueNumber: (num: number | null) => void;
    /** Deep-link: Mattermost channel to open when switching to mattermost tab */
    pendingChannelId: string | null;
    pendingChannelName: string | null;
    setPendingChannel: (id: string | null, name: string | null) => void;
}

export const useAppStore = create<AppStore>((set) => ({
    activeTab: 'mattermost',
    setActiveTab: (activeTab) => set({ activeTab }),
    pendingNoteId: null,
    setPendingNoteId: (pendingNoteId) => set({ pendingNoteId }),
    pendingPRNumber: null,
    setPendingPRNumber: (pendingPRNumber) => set({ pendingPRNumber }),
    pendingIssueNumber: null,
    setPendingIssueNumber: (pendingIssueNumber) => set({ pendingIssueNumber }),
    pendingChannelId: null,
    pendingChannelName: null,
    setPendingChannel: (pendingChannelId, pendingChannelName) =>
        set({ pendingChannelId, pendingChannelName }),
}));
