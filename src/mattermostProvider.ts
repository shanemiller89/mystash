import * as vscode from 'vscode';
import { MattermostService, MattermostTeam, MattermostChannel } from './mattermostService';
import { MattermostTeamItem, MattermostChannelItem } from './mattermostItem';

type MattermostTreeItem = MattermostTeamItem | MattermostChannelItem;

/**
 * TreeDataProvider for the Mattermost sidebar tree view.
 * Shows Teams > Channels hierarchy.
 */
export class MattermostProvider
    implements vscode.TreeDataProvider<MattermostTreeItem>, vscode.Disposable
{
    private _onDidChangeTreeData = new vscode.EventEmitter<
        MattermostTreeItem | undefined | null | void
    >();
    readonly onDidChangeTreeData: vscode.Event<MattermostTreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private _treeView?: vscode.TreeView<MattermostTreeItem>;
    private _refreshTimer?: ReturnType<typeof setTimeout>;
    private _isRefreshing = false;

    /** Cache: team → channels */
    private _cachedTeams: MattermostTeam[] = [];
    private _cachedChannels = new Map<string, MattermostChannel[]>();

    // Search
    private _searchQuery = '';

    // Visibility-gated refresh
    private _isVisible = true;
    private _pendingRefreshReason?: string;

    private static readonly DEBOUNCE_MS = 300;

    constructor(
        private readonly _mattermostService: MattermostService,
        private readonly _outputChannel?: vscode.OutputChannel,
    ) {}

    // ─── Tree View Binding ────────────────────────────────────────

    setTreeView(treeView: vscode.TreeView<MattermostTreeItem>): void {
        this._treeView = treeView;

        treeView.onDidChangeVisibility((e) => {
            this._isVisible = e.visible;
            if (e.visible && this._pendingRefreshReason) {
                this._outputChannel?.appendLine(
                    `[Mattermost REFRESH] flushing deferred: ${this._pendingRefreshReason}`,
                );
                const reason = this._pendingRefreshReason;
                this._pendingRefreshReason = undefined;
                this.refresh(reason);
            }
        });
    }

    // ─── Refresh ──────────────────────────────────────────────────

    refresh(reason?: string): void {
        if (!this._isVisible) {
            this._pendingRefreshReason = reason ?? 'deferred';
            this._outputChannel?.appendLine(
                `[Mattermost] deferring refresh (hidden): ${reason ?? '?'}`,
            );
            return;
        }

        // Debounce
        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
        }

        this._refreshTimer = setTimeout(() => {
            this._refreshTimer = undefined;
            this._outputChannel?.appendLine(`[Mattermost REFRESH] firing: ${reason ?? '?'}`);
            this._onDidChangeTreeData.fire();
        }, MattermostProvider.DEBOUNCE_MS);
    }

    // ─── Search ───────────────────────────────────────────────────

    async search(): Promise<void> {
        const query = await vscode.window.showInputBox({
            prompt: 'Search channels by name',
            placeHolder: 'channel name…',
            value: this._searchQuery,
        });
        if (query === undefined) { return; } // cancelled
        this._searchQuery = query;
        void vscode.commands.executeCommand(
            'setContext',
            'workstash.mattermost.isSearching',
            query.length > 0,
        );
        this.refresh('search');
    }

    clearSearch(): void {
        this._searchQuery = '';
        void vscode.commands.executeCommand(
            'setContext',
            'workstash.mattermost.isSearching',
            false,
        );
        this.refresh('clear-search');
    }

    // ─── TreeDataProvider ─────────────────────────────────────────

    getTreeItem(element: MattermostTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: MattermostTreeItem): Promise<MattermostTreeItem[]> {
        const isConfigured = await this._mattermostService.isConfigured();

        if (!isConfigured) {
            this._updateChrome(0);
            void vscode.commands.executeCommand('setContext', 'workstash.isMattermostConfigured', false);
            return [];
        }

        void vscode.commands.executeCommand('setContext', 'workstash.isMattermostConfigured', true);

        // Root level: teams
        if (!element) {
            return this._getTeams();
        }

        // Team children: channels
        if (element instanceof MattermostTeamItem) {
            return this._getChannels(element.team.id);
        }

        return [];
    }

    private async _getTeams(): Promise<MattermostTreeItem[]> {
        if (this._isRefreshing) { return []; }
        this._isRefreshing = true;

        try {
            this._cachedTeams = await this._mattermostService.getMyTeams();
            this._cachedChannels.clear();

            const totalTeams = this._cachedTeams.length;
            void vscode.commands.executeCommand(
                'setContext',
                'workstash.hasMattermostTeams',
                totalTeams > 0,
            );
            this._updateChrome(totalTeams);

            return this._cachedTeams.map((t) => new MattermostTeamItem(t));
        } catch (error: unknown) {
            this._outputChannel?.appendLine(
                `[Mattermost] getTeams error: ${error instanceof Error ? error.message : error}`,
            );
            return [];
        } finally {
            this._isRefreshing = false;
        }
    }

    private async _getChannels(teamId: string): Promise<MattermostTreeItem[]> {
        try {
            let channels = this._cachedChannels.get(teamId);
            if (!channels) {
                channels = await this._mattermostService.getMyChannels(teamId);
                this._cachedChannels.set(teamId, channels);
            }

            let filtered = channels;
            if (this._searchQuery) {
                const q = this._searchQuery.toLowerCase();
                filtered = channels.filter(
                    (c) =>
                        c.displayName.toLowerCase().includes(q) ||
                        c.name.toLowerCase().includes(q),
                );
            }

            return filtered.map(
                (c) => new MattermostChannelItem(c, this._searchQuery || undefined),
            );
        } catch (error: unknown) {
            this._outputChannel?.appendLine(
                `[Mattermost] getChannels error: ${error instanceof Error ? error.message : error}`,
            );
            return [];
        }
    }

    // ─── Chrome ───────────────────────────────────────────────────

    private _updateChrome(teamCount: number): void {
        if (!this._treeView) { return; }

        if (teamCount > 0) {
            this._treeView.badge = { value: teamCount, tooltip: `${teamCount} team(s)` };
            this._treeView.title = 'Mattermost';
        } else {
            this._treeView.badge = undefined;
            this._treeView.title = 'Mattermost';
        }
    }

    // ─── Dispose ──────────────────────────────────────────────────

    dispose(): void {
        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
        }
        this._onDidChangeTreeData.dispose();
    }
}
