import * as vscode from 'vscode';
import { AuthService } from './authService';

// ─── Data Models ──────────────────────────────────────────────────

export type PRState = 'open' | 'closed' | 'merged';

/** Filter for "whose PRs" — currently only 'authored', future: 'assigned', 'review-requested' */
export type PRAuthorFilter = 'authored';
// TODO: Add 'assigned' | 'review-requested' filters

export interface PullRequest {
    number: number;
    title: string;
    state: PRState;
    htmlUrl: string;
    body: string;
    author: string;
    authorAvatarUrl: string;
    branch: string; // head ref
    baseBranch: string; // base ref
    createdAt: Date;
    updatedAt: Date;
    mergedAt: Date | null;
    closedAt: Date | null;
    commentsCount: number;
    additions: number;
    deletions: number;
    changedFiles: number;
    labels: { name: string; color: string }[];
    isDraft: boolean;
}

export interface PRComment {
    id: number;
    body: string;
    author: string;
    authorAvatarUrl: string;
    createdAt: Date;
    updatedAt: Date;
    htmlUrl: string;
    /** Review-comment fields (absent for issue comments) */
    isReviewComment: boolean;
    path?: string;
    line?: number | null;
    diffHunk?: string;
}

/** Lightweight version sent to webview (dates as ISO strings) */
export interface PullRequestData {
    number: number;
    title: string;
    state: PRState;
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

// ─── GitHub API Response Types ────────────────────────────────────

/** Raw GitHub Pull Request API response (partial — only fields we use) */
interface GitHubPR {
    number: number;
    title: string;
    state: 'open' | 'closed';
    html_url: string;
    body: string | null;
    draft: boolean;
    user: { login: string; avatar_url: string } | null;
    head: { ref: string };
    base: { ref: string };
    created_at: string;
    updated_at: string;
    merged_at: string | null;
    closed_at: string | null;
    comments: number;
    review_comments?: number;
    additions?: number;
    deletions?: number;
    changed_files?: number;
    labels: { name: string; color: string }[];
}

/** Raw GitHub issue comment response */
interface GitHubComment {
    id: number;
    body: string;
    html_url: string;
    user: { login: string; avatar_url: string } | null;
    created_at: string;
    updated_at: string;
}

/** Raw GitHub pull request review comment response */
interface GitHubReviewComment {
    id: number;
    body: string;
    html_url: string;
    user: { login: string; avatar_url: string } | null;
    created_at: string;
    updated_at: string;
    path: string;
    line: number | null;
    original_line: number | null;
    diff_hunk: string;
}

// ─── Constants ────────────────────────────────────────────────────

const API_BASE = 'https://api.github.com';
const PER_PAGE = 30;

// ─── Types ────────────────────────────────────────────────────────

/** Injectable fetch function signature for testability */
export type FetchFn = typeof globalThis.fetch;

// ─── PrService ────────────────────────────────────────────────────

/**
 * REST API wrapper for GitHub Pull Request operations.
 * Uses Node built-in `fetch` (Node 18+). No runtime dependencies.
 * All calls go through `AuthService` for token.
 */
export class PrService {
    private readonly _authService: AuthService;
    private readonly _outputChannel: vscode.OutputChannel;
    private readonly _fetchFn: FetchFn;

    constructor(authService: AuthService, outputChannel: vscode.OutputChannel, fetchFn?: FetchFn) {
        this._authService = authService;
        this._outputChannel = outputChannel;
        this._fetchFn = fetchFn ?? globalThis.fetch.bind(globalThis);
    }

    // ─── Private Helpers ──────────────────────────────────────────

    private async _getToken(): Promise<string> {
        const token = await this._authService.getToken();
        if (!token) {
            throw new Error('Not authenticated. Please sign in to GitHub first.');
        }
        return token;
    }

    private async _request<T>(
        method: string,
        path: string,
        body?: unknown,
    ): Promise<{ data: T; headers: Headers }> {
        const token = await this._getToken();
        const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

        this._outputChannel.appendLine(`[PR] ${method} ${path}`);

        const headers: Record<string, string> = {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        };
        if (body) {
            headers['Content-Type'] = 'application/json';
        }

        const response = await this._fetchFn(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        this._checkRateLimit(response.headers);
        this._outputChannel.appendLine(`[PR] ${method} ${path} → ${response.status}`);

        if (!response.ok) {
            await this._handleHttpError(response);
        }

        if (response.status === 204) {
            return { data: undefined as T, headers: response.headers };
        }

        const data = (await response.json()) as T;
        return { data, headers: response.headers };
    }

    private _checkRateLimit(headers: Headers): void {
        const remaining = headers.get('X-RateLimit-Remaining');
        if (remaining !== null) {
            const count = parseInt(remaining, 10);
            if (count <= 10 && count > 0) {
                this._outputChannel.appendLine(
                    `[PR] ⚠ Rate limit low: ${count} requests remaining`,
                );
                vscode.window.showWarningMessage(
                    `GitHub API rate limit low: ${count} requests remaining.`,
                );
            } else if (count === 0) {
                const resetHeader = headers.get('X-RateLimit-Reset');
                const resetTime = resetHeader
                    ? new Date(parseInt(resetHeader, 10) * 1000).toLocaleTimeString()
                    : 'soon';
                this._outputChannel.appendLine(
                    `[PR] ⚠ Rate limit exhausted, resets at ${resetTime}`,
                );
            }
        }
    }

    private async _handleHttpError(response: Response): Promise<never> {
        let detail = '';
        try {
            const body = (await response.json()) as { message?: string };
            detail = body.message ?? '';
        } catch {
            /* ignore parse failure */
        }

        switch (response.status) {
            case 401:
                throw new Error('GitHub session expired. Please sign in again.');
            case 403:
                throw new Error('Rate limit exceeded. Try again later.');
            case 404:
                throw new Error('Repository not found or no access.');
            case 422:
                throw new Error(`Invalid request${detail ? `: ${detail}` : ''}.`);
            default:
                throw new Error(
                    `GitHub API error ${response.status}${detail ? `: ${detail}` : ''}`,
                );
        }
    }

    // ─── Parsing ──────────────────────────────────────────────────

    private _parsePR(pr: GitHubPR): PullRequest {
        // GitHub API returns state as 'open' | 'closed'. We derive 'merged' from merged_at.
        let state: PRState = pr.state;
        if (pr.state === 'closed' && pr.merged_at) {
            state = 'merged';
        }

        return {
            number: pr.number,
            title: pr.title,
            state,
            htmlUrl: pr.html_url,
            body: pr.body ?? '',
            author: pr.user?.login ?? 'unknown',
            authorAvatarUrl: pr.user?.avatar_url ?? '',
            branch: pr.head.ref,
            baseBranch: pr.base.ref,
            createdAt: new Date(pr.created_at),
            updatedAt: new Date(pr.updated_at),
            mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
            closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
            commentsCount: (pr.comments ?? 0) + (pr.review_comments ?? 0),
            additions: pr.additions ?? 0,
            deletions: pr.deletions ?? 0,
            changedFiles: pr.changed_files ?? 0,
            labels: pr.labels.map((l) => ({ name: l.name, color: l.color })),
            isDraft: pr.draft,
        };
    }

    private _parseComment(comment: GitHubComment): PRComment {
        return {
            id: comment.id,
            body: comment.body,
            author: comment.user?.login ?? 'unknown',
            authorAvatarUrl: comment.user?.avatar_url ?? '',
            createdAt: new Date(comment.created_at),
            updatedAt: new Date(comment.updated_at),
            htmlUrl: comment.html_url,
            isReviewComment: false,
        };
    }

    private _parseReviewComment(comment: GitHubReviewComment): PRComment {
        return {
            id: comment.id,
            body: comment.body,
            author: comment.user?.login ?? 'unknown',
            authorAvatarUrl: comment.user?.avatar_url ?? '',
            createdAt: new Date(comment.created_at),
            updatedAt: new Date(comment.updated_at),
            htmlUrl: comment.html_url,
            isReviewComment: true,
            path: comment.path,
            line: comment.line ?? comment.original_line,
            diffHunk: comment.diff_hunk,
        };
    }

    // ─── Public API ───────────────────────────────────────────────

    /**
     * List pull requests for a repository.
     * Uses the pulls endpoint with state filter, then filters by author client-side.
     *
     * @param owner   Repository owner
     * @param repo    Repository name
     * @param state   Filter: 'open', 'closed', 'merged', or 'all'
     * @param author  GitHub username to filter by (author filter)
     */
    async listPullRequests(
        owner: string,
        repo: string,
        state: PRState | 'all' = 'all',
        author?: string,
    ): Promise<PullRequest[]> {
        // GitHub API only knows 'open' | 'closed' | 'all' for state param
        // We handle 'merged' as closed + merged_at not null
        const apiState = state === 'merged' ? 'closed' : state;

        const { data } = await this._request<GitHubPR[]>(
            'GET',
            `/repos/${owner}/${repo}/pulls?state=${apiState}&sort=updated&direction=desc&per_page=${PER_PAGE}`,
        );

        let prs = data.map((pr) => this._parsePR(pr));

        // Filter by author if specified
        if (author) {
            prs = prs.filter((pr) => pr.author.toLowerCase() === author.toLowerCase());
        }

        // If user asked for 'merged', filter to only merged PRs
        if (state === 'merged') {
            prs = prs.filter((pr) => pr.state === 'merged');
        }

        return prs;
    }

    /**
     * Get a single pull request with full detail (includes additions/deletions/changed_files).
     */
    async getPullRequest(owner: string, repo: string, prNumber: number): Promise<PullRequest> {
        const { data } = await this._request<GitHubPR>(
            'GET',
            `/repos/${owner}/${repo}/pulls/${prNumber}`,
        );
        return this._parsePR(data);
    }

    /**
     * Get ALL comments on a pull request — both issue comments (main thread)
     * and review comments (inline code comments). Merged and sorted chronologically.
     */
    async getComments(owner: string, repo: string, prNumber: number): Promise<PRComment[]> {
        // Fetch both endpoints in parallel
        const [issueRes, reviewRes] = await Promise.all([
            this._request<GitHubComment[]>(
                'GET',
                `/repos/${owner}/${repo}/issues/${prNumber}/comments?per_page=100&sort=created&direction=asc`,
            ),
            this._request<GitHubReviewComment[]>(
                'GET',
                `/repos/${owner}/${repo}/pulls/${prNumber}/comments?per_page=100&sort=created&direction=asc`,
            ),
        ]);

        const issueComments = issueRes.data.map((c) => this._parseComment(c));
        const reviewComments = reviewRes.data.map((c) => this._parseReviewComment(c));

        // Merge and sort by creation date
        const all = [...issueComments, ...reviewComments];
        all.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        return all;
    }

    /**
     * Post a comment on a pull request.
     */
    async createComment(
        owner: string,
        repo: string,
        prNumber: number,
        body: string,
    ): Promise<PRComment> {
        const { data } = await this._request<GitHubComment>(
            'POST',
            `/repos/${owner}/${repo}/issues/${prNumber}/comments`,
            { body },
        );
        return this._parseComment(data);
    }

    /**
     * Get the authenticated user's GitHub login name.
     */
    async getAuthenticatedUser(): Promise<string> {
        const { data } = await this._request<{ login: string }>('GET', '/user');
        return data.login;
    }

    // ─── Static Converters ────────────────────────────────────────

    /** Convert a PullRequest to its webview-safe data shape. */
    static toData(pr: PullRequest): PullRequestData {
        return {
            number: pr.number,
            title: pr.title,
            state: pr.state,
            htmlUrl: pr.htmlUrl,
            body: pr.body,
            author: pr.author,
            authorAvatarUrl: pr.authorAvatarUrl,
            branch: pr.branch,
            baseBranch: pr.baseBranch,
            createdAt: pr.createdAt.toISOString(),
            updatedAt: pr.updatedAt.toISOString(),
            mergedAt: pr.mergedAt?.toISOString() ?? null,
            closedAt: pr.closedAt?.toISOString() ?? null,
            commentsCount: pr.commentsCount,
            additions: pr.additions,
            deletions: pr.deletions,
            changedFiles: pr.changedFiles,
            labels: pr.labels,
            isDraft: pr.isDraft,
        };
    }

    /** Convert a PRComment to its webview-safe data shape. */
    static toCommentData(comment: PRComment): PRCommentData {
        return {
            id: comment.id,
            body: comment.body,
            author: comment.author,
            authorAvatarUrl: comment.authorAvatarUrl,
            createdAt: comment.createdAt.toISOString(),
            updatedAt: comment.updatedAt.toISOString(),
            htmlUrl: comment.htmlUrl,
            isReviewComment: comment.isReviewComment,
            path: comment.path,
            line: comment.line,
            diffHunk: comment.diffHunk,
        };
    }
}
