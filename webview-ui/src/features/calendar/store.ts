import { create } from 'zustand';

// ─── Data types (mirrors extension-side models) ───────────────────

export interface CalendarListEntryData {
    id: string;
    summary: string;
    description?: string;
    backgroundColor?: string;
    foregroundColor?: string;
    primary?: boolean;
    selected?: boolean;
    accessRole: string;
    timeZone?: string;
}

export interface CalendarEventDateTime {
    dateTime?: string;
    date?: string;
    timeZone?: string;
}

export interface CalendarEventData {
    id: string;
    summary?: string;
    description?: string;
    location?: string;
    start: CalendarEventDateTime;
    end: CalendarEventDateTime;
    status?: string;
    htmlLink?: string;
    colorId?: string;
    creator?: { email?: string; displayName?: string };
    organizer?: { email?: string; displayName?: string };
    attendees?: { email: string; displayName?: string; responseStatus?: string }[];
    transparency?: string;
    hangoutLink?: string;
    conferenceData?: {
        entryPoints?: { entryPointType: string; uri: string; label?: string }[];
    };
    // Added by store for display
    calendarId?: string;
    calendarColor?: string;
}

export type CalendarViewMode = 'dayGridMonth' | 'timeGridWeek' | 'listWeek' | 'listDay';

// ─── Store ────────────────────────────────────────────────────────

interface CalendarStore {
    // Auth
    isAuthenticated: boolean;
    accountEmail: string | null;
    setAuthenticated: (auth: boolean, email?: string | null) => void;

    // Calendars
    calendars: CalendarListEntryData[];
    enabledCalendarIds: Set<string>;
    setCalendars: (calendars: CalendarListEntryData[]) => void;
    toggleCalendar: (calendarId: string) => void;

    // Events
    events: CalendarEventData[];
    isLoading: boolean;
    error: string | null;
    setEvents: (events: CalendarEventData[]) => void;
    appendEvents: (events: CalendarEventData[]) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;

    // View state
    viewMode: CalendarViewMode;
    setViewMode: (mode: CalendarViewMode) => void;

    // Selected event
    selectedEvent: CalendarEventData | null;
    selectEvent: (event: CalendarEventData | null) => void;

    // Date range for fetching
    visibleRangeStart: string | null;
    visibleRangeEnd: string | null;
    setVisibleRange: (start: string, end: string) => void;
}

export const useCalendarStore = create<CalendarStore>((set, get) => ({
    // Auth
    isAuthenticated: false,
    accountEmail: null,
    setAuthenticated: (auth, email) =>
        set({ isAuthenticated: auth, accountEmail: email ?? null }),

    // Calendars
    calendars: [],
    enabledCalendarIds: new Set<string>(),
    setCalendars: (calendars) => {
        // Enable all calendars by default on first load
        const current = get().enabledCalendarIds;
        if (current.size === 0) {
            const allIds = new Set(calendars.map((c) => c.id));
            set({ calendars, enabledCalendarIds: allIds, isLoading: false });
        } else {
            set({ calendars, isLoading: false });
        }
    },
    toggleCalendar: (calendarId) =>
        set((state) => {
            const next = new Set(state.enabledCalendarIds);
            if (next.has(calendarId)) {
                next.delete(calendarId);
            } else {
                next.add(calendarId);
            }
            return { enabledCalendarIds: next };
        }),

    // Events
    events: [],
    isLoading: false,
    error: null,
    setEvents: (events) => set({ events, isLoading: false, error: null }),
    appendEvents: (newEvents) =>
        set((state) => ({
            events: [...state.events, ...newEvents],
            isLoading: false,
        })),
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error, isLoading: false }),

    // View state
    viewMode: 'dayGridMonth',
    setViewMode: (viewMode) => set({ viewMode }),

    // Selected event
    selectedEvent: null,
    selectEvent: (selectedEvent) => set({ selectedEvent }),

    // Date range
    visibleRangeStart: null,
    visibleRangeEnd: null,
    setVisibleRange: (visibleRangeStart, visibleRangeEnd) =>
        set({ visibleRangeStart, visibleRangeEnd }),
}));
