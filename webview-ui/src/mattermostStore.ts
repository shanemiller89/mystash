import { create } from 'zustand';

/** Lightweight data shapes received from the extension */
export interface MattermostTeamData {
    id: string;
    name: string;
    displayName: string;
    description: string;
    type: 'O' | 'I';
}

export interface MattermostChannelData {
    id: string;
    teamId: string;
    name: string;
    displayName: string;
    type: 'O' | 'P' | 'D' | 'G';
    header: string;
    purpose: string;
    lastPostAt: string;
}

export interface MattermostPostData {
    id: string;
    channelId: string;
    userId: string;
    username: string;
    message: string;
    createAt: string;
    updateAt: string;
    rootId: string;
    type: string;
}

export interface MattermostUserData {
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    nickname: string;
}

interface MattermostStore {
    // Auth / config state
    isConfigured: boolean;
    currentUser: MattermostUserData | null;

    // Teams & Channels
    teams: MattermostTeamData[];
    channels: MattermostChannelData[]; // for the selected team
    selectedTeamId: string | null;
    selectedChannelId: string | null;
    selectedChannelName: string | null;

    // Messages
    posts: MattermostPostData[];
    isLoadingPosts: boolean;
    isLoadingChannels: boolean;
    isSendingMessage: boolean;
    hasMorePosts: boolean;

    // Search
    searchQuery: string;

    // Actions
    setConfigured: (configured: boolean) => void;
    setCurrentUser: (user: MattermostUserData | null) => void;
    setTeams: (teams: MattermostTeamData[]) => void;
    setChannels: (channels: MattermostChannelData[]) => void;
    selectTeam: (teamId: string) => void;
    selectChannel: (channelId: string, channelName: string) => void;
    clearChannelSelection: () => void;
    setPosts: (posts: MattermostPostData[]) => void;
    appendOlderPosts: (posts: MattermostPostData[]) => void;
    prependNewPost: (post: MattermostPostData) => void;
    setLoadingPosts: (loading: boolean) => void;
    setLoadingChannels: (loading: boolean) => void;
    setSendingMessage: (sending: boolean) => void;
    setHasMorePosts: (hasMore: boolean) => void;
    setSearchQuery: (query: string) => void;
}

const EMPTY_TEAMS: MattermostTeamData[] = [];
const EMPTY_CHANNELS: MattermostChannelData[] = [];
const EMPTY_POSTS: MattermostPostData[] = [];

export const useMattermostStore = create<MattermostStore>((set) => ({
    isConfigured: false,
    currentUser: null,
    teams: EMPTY_TEAMS,
    channels: EMPTY_CHANNELS,
    selectedTeamId: null,
    selectedChannelId: null,
    selectedChannelName: null,
    posts: EMPTY_POSTS,
    isLoadingPosts: false,
    isLoadingChannels: false,
    isSendingMessage: false,
    hasMorePosts: true,
    searchQuery: '',

    setConfigured: (isConfigured) => set({ isConfigured }),
    setCurrentUser: (currentUser) => set({ currentUser }),
    setTeams: (teams) => set({ teams }),
    setChannels: (channels) => set({ channels }),
    selectTeam: (teamId) =>
        set({
            selectedTeamId: teamId,
            selectedChannelId: null,
            selectedChannelName: null,
            posts: EMPTY_POSTS,
            channels: EMPTY_CHANNELS,
        }),
    selectChannel: (channelId, channelName) =>
        set({
            selectedChannelId: channelId,
            selectedChannelName: channelName,
            posts: EMPTY_POSTS,
            hasMorePosts: true,
        }),
    clearChannelSelection: () =>
        set({
            selectedChannelId: null,
            selectedChannelName: null,
            posts: EMPTY_POSTS,
        }),
    setPosts: (posts) => set({ posts }),
    appendOlderPosts: (olderPosts) =>
        set((state) => ({
            posts: [...state.posts, ...olderPosts],
        })),
    prependNewPost: (post) =>
        set((state) => ({
            posts: [post, ...state.posts],
        })),
    setLoadingPosts: (isLoadingPosts) => set({ isLoadingPosts }),
    setLoadingChannels: (isLoadingChannels) => set({ isLoadingChannels }),
    setSendingMessage: (isSendingMessage) => set({ isSendingMessage }),
    setHasMorePosts: (hasMorePosts) => set({ hasMorePosts }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
