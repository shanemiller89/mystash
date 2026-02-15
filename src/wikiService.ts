import * as vscode from 'vscode';
import { AuthService } from './authService';

// ─── Data Models ──────────────────────────────────────────────────

export interface WikiPage {
    /** Page title (derived from filename, e.g. "Home" from "Home.md") */
    title: string;
    /** Filename in the wiki repo, e.g. "Home.md" */
    filename: string;
    /** Raw markdown content of the page */
    content: string;
    /** SHA of the blob (for caching) */
    sha: string;
}

/** Lightweight list-only version (no content yet) */
export interface WikiPageSummary {
    title: string;
    filename: string;
    sha: string;
    /** File size in bytes */
    size: number;
}

/** Webview-safe shape sent via postMessage */
export interface WikiPageData {
    title: string;
    filename: string;
    content: string;
    sha: string;
}

export interface WikiPageSummaryData {
    title: string;
    filename: string;
    sha: string;
    size: number;
}

// ─── GitHub API Response Types ────────────────────────────────────

interface GitHubTreeItem {
    path: string;
    mode: string;
    type: 'blob' | 'tree';
    sha: string;
    size?: number;
    url: string;
}

interface GitHubTreeResponse {
    sha: string;
    url: string;
    tree: GitHubTreeItem[];
    truncated: boolean;
}

interface GitHubBlobResponse {
    sha: string;
    node_id: string;
    size: number;
    url: string;
    content: string;
    encoding: 'base64' | 'utf-8';
}

interface GitHubContentResponse {
    name: string;
    path: string;
    sha: string;
    size: number;
    type: 'file' | 'dir';
    content?: string;
    encoding?: string;
    download_url: string | null;
    html_url: string;
}

// ─── Constants ────────────────────────────────────────────────────

const API_BASE = 'https://api.github.com';
const RAW_BASE = 'https://raw.githubusercontent.com/wiki';

/** File extensions that are valid wiki page formats */
const WIKI_EXTENSIONS = new Set(['.md', '.markdown', '.mediawiki', '.textile', '.rdoc', '.org', '.creole', '.pod', '.asciidoc', '.rst']);

// ─── Types ────────────────────────────────────────────────────────

/** Injectable fetch function signature for testability */
export type FetchFn = typeof globalThis.fetch;

// ─── WikiService ──────────────────────────────────────────────────

/**
 * REST API wrapper for reading GitHub Wiki pages.
 *
 * GitHub wikis are stored in a separate git repo (`owner/repo.wiki`).
 * We use the Git Trees API and raw content fetches to list and read pages
 * without cloning the wiki repo locally.
 */
export class WikiService {
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
    ): Promise<{ data: T; headers: Headers }> {
        const token = await this._getToken();
        const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

        this._outputChannel.appendLine(`[Wiki] ${method} ${path}`);

        const headers: Record<string, string> = {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        };

        const response = await this._fetchFn(url, { method, headers });

        this._checkRateLimit(response.headers);
        this._outputChannel.appendLine(`[Wiki] ${method} ${path} → ${response.status}`);

        if (!response.ok) {
            await this._handleHttpError(response);
        }

        const data = (await response.json()) as T;
        return { data, headers: response.headers };
    }

    private async _requestRaw(url: string): Promise<string> {
        const token = await this._getToken();

        this._outputChannel.appendLine(`[Wiki] GET (raw) ${url}`);

        const response = await this._fetchFn(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.raw+json',
                'X-GitHub-Api-Version': '2022-11-28',
            },
        });

        this._outputChannel.appendLine(`[Wiki] GET (raw) ${url} → ${response.status}`);

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Wiki page not found.');
            }
            await this._handleHttpError(response);
        }

        return response.text();
    }

    private _checkRateLimit(headers: Headers): void {
        const remaining = headers.get('X-RateLimit-Remaining');
        if (remaining !== null) {
            const count = parseInt(remaining, 10);
            if (count <= 10 && count > 0) {
                this._outputChannel.appendLine(
                    `[Wiki] ⚠ Rate limit low: ${count} requests remaining`,
                );
            } else if (count === 0) {
                const resetHeader = headers.get('X-RateLimit-Reset');
                const resetTime = resetHeader
                    ? new Date(parseInt(resetHeader, 10) * 1000).toLocaleTimeString()
                    : 'soon';
                this._outputChannel.appendLine(
                    `[Wiki] ⚠ Rate limit exhausted, resets at ${resetTime}`,
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
                throw new Error(
                    detail.includes('rate limit')
                        ? 'GitHub API rate limit exceeded. Try again later.'
                        : `Access denied: ${detail}`,
                );
            case 404:
                throw new Error('Wiki not found. This repository may not have a wiki enabled.');
            default:
                throw new Error(`GitHub API error ${response.status}: ${detail}`);
        }
    }

    /** Extract a human-readable title from a wiki filename */
    private _titleFromFilename(filename: string): string {
        // Remove the extension, then replace hyphens and underscores with spaces
        const dotIdx = filename.lastIndexOf('.');
        const base = dotIdx > 0 ? filename.substring(0, dotIdx) : filename;
        return base.replace(/[-_]/g, ' ');
    }

    /** Check if a filename is a valid wiki page (by extension) */
    private _isWikiPage(filename: string): boolean {
        const dotIdx = filename.lastIndexOf('.');
        if (dotIdx <= 0) { return false; }
        const ext = filename.substring(dotIdx).toLowerCase();
        return WIKI_EXTENSIONS.has(ext);
    }

    // ─── Public API ───────────────────────────────────────────────

    /**
     * Check whether a wiki exists for the given repository.
     * Returns `true` if the wiki repo has at least one page.
     */
    async hasWiki(owner: string, repo: string): Promise<boolean> {
        try {
            const pages = await this.listPages(owner, repo);
            return pages.length > 0;
        } catch {
            return false;
        }
    }

    /**
     * List all wiki pages for a repository.
     * Uses the Git Trees API against the wiki repo's default branch.
     */
    async listPages(owner: string, repo: string): Promise<WikiPageSummary[]> {
        // The wiki repo is {owner}/{repo}.wiki — we use its git tree
        const { data } = await this._request<GitHubTreeResponse>(
            'GET',
            `/repos/${owner}/${repo}.wiki/git/trees/HEAD?recursive=1`,
        );

        const pages: WikiPageSummary[] = [];

        for (const item of data.tree) {
            if (item.type !== 'blob') { continue; }
            if (!this._isWikiPage(item.path)) { continue; }

            // Skip files in subdirectories like _Sidebar.md, _Footer.md (convention)
            // but include them if they're top-level content pages
            const filename = item.path;
            pages.push({
                title: this._titleFromFilename(filename),
                filename,
                sha: item.sha,
                size: item.size ?? 0,
            });
        }

        // Sort: Home first, then alphabetical by title
        pages.sort((a, b) => {
            if (a.title === 'Home') { return -1; }
            if (b.title === 'Home') { return 1; }
            return a.title.localeCompare(b.title);
        });

        return pages;
    }

    /**
     * Fetch the raw markdown content of a specific wiki page.
     * Uses the Contents API against the wiki repo.
     */
    async getPageContent(owner: string, repo: string, filename: string): Promise<WikiPage> {
        const encodedPath = encodeURIComponent(filename);
        const { data } = await this._request<GitHubContentResponse>(
            'GET',
            `/repos/${owner}/${repo}.wiki/contents/${encodedPath}`,
        );

        let content: string;
        if (data.content && data.encoding === 'base64') {
            content = Buffer.from(data.content, 'base64').toString('utf-8');
        } else if (data.download_url) {
            // Fall back to raw download for large files
            content = await this._requestRaw(data.download_url);
        } else {
            content = '';
        }

        return {
            title: this._titleFromFilename(filename),
            filename,
            content,
            sha: data.sha,
        };
    }

    /**
     * Get the URL to view a wiki page on GitHub.com.
     */
    getPageUrl(owner: string, repo: string, filename: string): string {
        const dotIdx = filename.lastIndexOf('.');
        const slug = dotIdx > 0 ? filename.substring(0, dotIdx) : filename;
        return `https://github.com/${owner}/${repo}/wiki/${slug}`;
    }

    /**
     * Get the URL to the wiki home page on GitHub.com.
     */
    getWikiUrl(owner: string, repo: string): string {
        return `https://github.com/${owner}/${repo}/wiki`;
    }

    // ─── Static Converters ────────────────────────────────────────

    /** Convert a WikiPageSummary to its webview-safe data shape. */
    static toSummaryData(page: WikiPageSummary): WikiPageSummaryData {
        return {
            title: page.title,
            filename: page.filename,
            sha: page.sha,
            size: page.size,
        };
    }

    /** Convert a WikiPage to its webview-safe data shape. */
    static toPageData(page: WikiPage): WikiPageData {
        return {
            title: page.title,
            filename: page.filename,
            content: page.content,
            sha: page.sha,
        };
    }
}
