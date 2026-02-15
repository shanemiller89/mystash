import * as vscode from 'vscode';
import { GoogleAuthProvider } from './googleAuthProvider';

// ─── Data Models ──────────────────────────────────────────────────

export interface CalendarListEntry {
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

export interface CalendarListResponse {
    kind: string;
    items: CalendarListEntry[];
    nextPageToken?: string;
}

export interface CalendarEventDateTime {
    dateTime?: string; // RFC3339 for timed events
    date?: string;     // YYYY-MM-DD for all-day events
    timeZone?: string;
}

export interface CalendarEvent {
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
    recurringEventId?: string;
    transparency?: string; // 'opaque' | 'transparent'
    visibility?: string;
    hangoutLink?: string;
    conferenceData?: {
        entryPoints?: { entryPointType: string; uri: string; label?: string }[];
    };
}

export interface CalendarEventsResponse {
    kind: string;
    summary: string;
    items: CalendarEvent[];
    nextPageToken?: string;
    timeZone?: string;
}

// ─── Constants ────────────────────────────────────────────────────

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

// ─── Service ──────────────────────────────────────────────────────

export class GoogleCalendarService {
    private readonly _authProvider: GoogleAuthProvider;
    private readonly _outputChannel: vscode.OutputChannel;

    private readonly _onDidChangeAuth = new vscode.EventEmitter<void>();
    readonly onDidChangeAuth = this._onDidChangeAuth.event;

    constructor(
        authProvider: GoogleAuthProvider,
        outputChannel: vscode.OutputChannel,
    ) {
        this._authProvider = authProvider;
        this._outputChannel = outputChannel;
    }

    // ─── Auth helpers ─────────────────────────────────────────────

    async isAuthenticated(): Promise<boolean> {
        return this._authProvider.isAuthenticated();
    }

    async signIn(): Promise<void> {
        await vscode.authentication.getSession(GoogleAuthProvider.id, [], { createIfNone: true });
        this._onDidChangeAuth.fire();
    }

    async signOut(): Promise<void> {
        const sessions = await this._authProvider.getSessions();
        for (const session of sessions) {
            await this._authProvider.removeSession(session.id);
        }
        this._onDidChangeAuth.fire();
    }

    // ─── Calendar API ─────────────────────────────────────────────

    /**
     * List all calendars the user has access to.
     */
    async listCalendars(): Promise<CalendarListEntry[]> {
        const response = await this._get<CalendarListResponse>(
            '/users/me/calendarList?minAccessRole=reader',
        );
        return response.items ?? [];
    }

    /**
     * List events for a calendar within a time range.
     * Defaults to current month ± buffer.
     */
    async listEvents(
        calendarId = 'primary',
        timeMin?: string,
        timeMax?: string,
        maxResults = 250,
        pageToken?: string,
    ): Promise<CalendarEventsResponse> {
        const now = new Date();
        const defaultMin = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
        const defaultMax = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

        const params = new URLSearchParams({
            timeMin: timeMin ?? defaultMin,
            timeMax: timeMax ?? defaultMax,
            maxResults: String(maxResults),
            singleEvents: 'true',
            orderBy: 'startTime',
        });
        if (pageToken) {
            params.set('pageToken', pageToken);
        }

        const encodedCalendarId = encodeURIComponent(calendarId);
        return this._get<CalendarEventsResponse>(
            `/calendars/${encodedCalendarId}/events?${params}`,
        );
    }

    // ─── Private helpers ──────────────────────────────────────────

    private async _getToken(): Promise<string> {
        const token = await this._authProvider.getAccessToken();
        if (!token) {
            throw new Error('Not authenticated with Google. Please sign in first.');
        }
        return token;
    }

    private async _get<T>(path: string): Promise<T> {
        const token = await this._getToken();
        const url = path.startsWith('http') ? path : `${CALENDAR_API}${path}`;

        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401) {
            // Token expired — try once more after refresh
            const freshToken = await this._authProvider.getAccessToken();
            if (freshToken && freshToken !== token) {
                const retry = await fetch(url, {
                    headers: { Authorization: `Bearer ${freshToken}` },
                });
                if (!retry.ok) {
                    throw new Error(`Calendar API error (${retry.status})`);
                }
                return retry.json() as Promise<T>;
            }
            throw new Error('Authentication expired. Please sign in again.');
        }

        if (!response.ok) {
            const text = await response.text();
            this._outputChannel.appendLine(`[Calendar] API error: ${response.status} ${text}`);
            throw new Error(`Calendar API error (${response.status}): ${text}`);
        }

        return response.json() as Promise<T>;
    }
}
