import { create } from 'zustand';

/** Lightweight PR data shape received from the extension */
export interface PullRequestData {
    number: number;
    title: string;
    state: 'open' | 'closed' | 'merged';
    htmlUrl: string;
    body: string;
    author: string;
    authorAvatarUrl: string;
    branch: string;
    baseBranch: string;
    createdAt: string;
    updatedAt: string;
    mergedAt: string | null;
    closedAt: string | null;
    commentsCount: number;
    additions: number;
    deletions: number;
    changedFiles: number;
    labels: { name: string; color: string }[];
    isDraft: boolean;
}

export interface PRCommentData {
    id: number;
    body: string;
    author: string;
    authorAvatarUrl: string;
    createdAt: string;
    updatedAt: string;
    htmlUrl: string;
    /** Review-comment fields (absent for issue comments) */
    isReviewComment: boolean;
    path?: string;
    line?: number | null;
    diffHunk?: string;
}

export type PRStateFilter = 'open' | 'closed' | 'merged' | 'all';

interface PRStore {
    prs: PullRequestData[];
    selectedPRNumber: number | null;
    selectedPRDetail: PullRequestData | null;
    comments: PRCommentData[];
    stateFilter: PRStateFilter;
    isLoading: boolean;
    isCommentsLoading: boolean;
    isCommentSaving: boolean;
    isRepoNotFound: boolean;
    searchQuery: string;

    // Actions
    setPRs: (prs: PullRequestData[]) => void;
    selectPR: (prNumber: number) => void;
    clearSelection: () => void;
    setPRDetail: (pr: PullRequestData) => void;
    setComments: (comments: PRCommentData[]) => void;
    addComment: (comment: PRCommentData) => void;
    setStateFilter: (filter: PRStateFilter) => void;
    setLoading: (loading: boolean) => void;
    setCommentsLoading: (loading: boolean) => void;
    setCommentSaving: (saving: boolean) => void;
    setRepoNotFound: (notFound: boolean) => void;
    setSearchQuery: (query: string) => void;
    filteredPRs: () => PullRequestData[];
    selectedPR: () => PullRequestData | undefined;
}

export const usePRStore = create<PRStore>((set, get) => ({
    prs: [],
    selectedPRNumber: null,
    selectedPRDetail: null,
    comments: [],
    stateFilter: 'open',
    isLoading: false,
    isCommentsLoading: false,
    isCommentSaving: false,
    isRepoNotFound: false,
    searchQuery: '',

    setPRs: (prs) => {
        const { selectedPRNumber } = get();
        const stillExists =
            selectedPRNumber !== null && prs.some((pr) => pr.number === selectedPRNumber);
        set({
            prs,
            isLoading: false,
            ...(stillExists
                ? {}
                : {
                      selectedPRNumber: null,
                      selectedPRDetail: null,
                      comments: [],
                  }),
        });
    },

    selectPR: (prNumber) => {
        const { selectedPRNumber } = get();
        if (prNumber === selectedPRNumber) return;
        set({
            selectedPRNumber: prNumber,
            selectedPRDetail: null,
            comments: [],
            isCommentsLoading: true,
        });
    },

    clearSelection: () =>
        set({
            selectedPRNumber: null,
            selectedPRDetail: null,
            comments: [],
            isCommentsLoading: false,
        }),

    setPRDetail: (pr) => set({ selectedPRDetail: pr }),

    setComments: (comments) => set({ comments, isCommentsLoading: false }),

    addComment: (comment) =>
        set((state) => ({
            comments: [...state.comments, comment],
            isCommentSaving: false,
        })),

    setStateFilter: (stateFilter) =>
        set({
            stateFilter,
            selectedPRNumber: null,
            selectedPRDetail: null,
            comments: [],
            prs: [],
            isLoading: true,
        }),

    setLoading: (loading) => set({ isLoading: loading }),
    setCommentsLoading: (loading) => set({ isCommentsLoading: loading }),
    setCommentSaving: (saving) => set({ isCommentSaving: saving }),
    setRepoNotFound: (notFound) => set({ isRepoNotFound: notFound, isLoading: false }),

    setSearchQuery: (searchQuery) => set({ searchQuery }),

    filteredPRs: () => {
        const { prs, searchQuery } = get();
        const q = searchQuery.trim().toLowerCase();
        if (!q) return prs;
        return prs.filter(
            (pr) =>
                pr.title.toLowerCase().includes(q) ||
                `#${pr.number}`.includes(q) ||
                pr.branch.toLowerCase().includes(q),
        );
    },

    selectedPR: () => {
        const { prs, selectedPRNumber } = get();
        if (selectedPRNumber === null) return undefined;
        return prs.find((pr) => pr.number === selectedPRNumber);
    },
}));
