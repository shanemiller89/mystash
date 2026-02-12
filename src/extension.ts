import * as vscode from 'vscode';
import { GitService } from './gitService';
import { StashProvider } from './stashProvider';
import { StashItem, StashFileItem } from './stashItem';
import { StashContentProvider } from './stashContentProvider';
import { StashPanel } from './stashPanel';
import { pickStash } from './uiUtils';
import { getConfig } from './utils';

export function activate(context: vscode.ExtensionContext) {
	console.log('MyStash extension is now active!');

	// 0b-i: Create output channel for diagnostics
	const outputChannel = vscode.window.createOutputChannel('MyStash');
	context.subscriptions.push(outputChannel);

	const gitService = new GitService(
		vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
		outputChannel
	);

	// Register mystash: URI scheme for side-by-side diff viewing
	const contentProvider = new StashContentProvider(gitService);
	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider('mystash', contentProvider)
	);

	const stashProvider = new StashProvider(gitService, outputChannel);

	// 9b-i: Status bar item — shows stash count, click → focus tree view
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
	statusBarItem.command = 'mystashView.focus';
	statusBarItem.tooltip = 'MyStash — Click to view stashes';
	context.subscriptions.push(statusBarItem);
	stashProvider.setStatusBarItem(statusBarItem);

	// Register the tree view
	const treeView = vscode.window.createTreeView('mystashView', {
		treeDataProvider: stashProvider,
		showCollapseAll: true
	});
	context.subscriptions.push(treeView);
	stashProvider.setTreeView(treeView);

	// 1e-ii: Watch git stash ref files for changes
	// TODO: multi-root — watch all workspace folder .git directories
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
	if (workspaceRoot) {
		const stashRefPattern = new vscode.RelativePattern(workspaceRoot, '.git/{refs/stash,logs/refs/stash}');
		const gitWatcher = vscode.workspace.createFileSystemWatcher(stashRefPattern);
		gitWatcher.onDidChange(() => stashProvider.refresh('git-stash-changed'));
		gitWatcher.onDidCreate(() => stashProvider.refresh('git-stash-created'));
		gitWatcher.onDidDelete(() => stashProvider.refresh('git-stash-deleted'));
		context.subscriptions.push(gitWatcher);
	}

	// 1e-iii: Refresh on window focus (e.g. after external git operations)
	context.subscriptions.push(
		vscode.window.onDidChangeWindowState((state) => {
			if (state.focused && getConfig<boolean>('autoRefresh', true)) {
				stashProvider.refresh('window-focus');
			}
		})
	);

	// 9a-iv: Refresh when mystash settings change
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('mystash')) {
				stashProvider.refresh('settings-changed');
			}
		})
	);

	// Register commands
	context.subscriptions.push(
		vscode.commands.registerCommand('mystash.refresh', () => {
			stashProvider.refresh('manual');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('mystash.stash', async () => {
			// 2c: Guard — no changes means nothing to stash
			const hasChanges = await gitService.hasChanges();
			if (!hasChanges) {
				vscode.window.showInformationMessage('No local changes to stash');
				return;
			}

			// 2e: Cancel-safe message prompt
			let message = await vscode.window.showInputBox({
				prompt: 'Enter stash message (optional)',
				placeHolder: 'Stash message'
			});

			// Escape pressed → cancel
			if (message === undefined) { return; }

			// Empty submit → ask if intentional
			if (message === '') {
				const emptyOk = await vscode.window.showQuickPick(['Yes, no message', 'Let me type one'], {
					placeHolder: 'Create stash without a message?'
				});
				if (!emptyOk) { return; }
				if (emptyOk === 'Let me type one') {
					message = await vscode.window.showInputBox({
						prompt: 'Enter stash message',
						placeHolder: 'Stash message'
					});
					if (message === undefined) { return; }
				}
			}

			// 2d: Three-way stash mode QuickPick
			const defaultUntracked = getConfig<boolean>('defaultIncludeUntracked', false);
			const modeItems: vscode.QuickPickItem[] = [
				{ label: 'All Changes', description: 'Stash all tracked changes' },
				{ label: 'Include Untracked', description: 'Also stash untracked files (--include-untracked)' },
				{ label: 'Staged Only', description: 'Only stash staged changes (--staged, git 2.35+)' },
			];
			// Pre-select based on setting
			const defaultIndex = defaultUntracked ? 1 : 0;

			const modeQuickPick = vscode.window.createQuickPick();
			modeQuickPick.items = modeItems;
			modeQuickPick.activeItems = [modeItems[defaultIndex]];
			modeQuickPick.placeholder = 'What to include in the stash?';

			const modeChoice = await new Promise<vscode.QuickPickItem | undefined>((resolve) => {
				modeQuickPick.onDidAccept(() => {
					resolve(modeQuickPick.selectedItems[0]);
					modeQuickPick.dispose();
				});
				modeQuickPick.onDidHide(() => {
					resolve(undefined);
					modeQuickPick.dispose();
				});
				modeQuickPick.show();
			});

			// 2e: Escape on mode picker → cancel
			if (!modeChoice) { return; }

			const modeMap: Record<string, 'all' | 'staged' | 'untracked'> = {
				'All Changes': 'all',
				'Staged Only': 'staged',
				'Include Untracked': 'untracked',
			};
			const mode = modeMap[modeChoice.label] ?? 'all';

			// Use empty string as undefined for createStash (no -m flag)
			const stashMessage = message || undefined;

			// 2f: Progress indicator wrapping only the git call
			try {
				await vscode.window.withProgress(
					{ location: vscode.ProgressLocation.Notification, title: 'Creating stash…', cancellable: false },
					async () => {
						await gitService.createStash(stashMessage, mode);
					}
				);
				vscode.window.showInformationMessage('Stash created successfully');
				stashProvider.refresh('post-command');
			} catch (error: unknown) {
				const msg = error instanceof Error ? error.message : 'Unknown error';
				vscode.window.showErrorMessage(`Failed to create stash: ${msg}`);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('mystash.apply', async (item?: StashItem) => {
			if (!item) {
				const entry = await pickStash(gitService, 'Select a stash to apply');
				if (!entry) { return; }
				item = new StashItem(entry);
			}

			// 3d: Progress indicator
			const result = await vscode.window.withProgress(
				{ location: vscode.ProgressLocation.Notification, title: `Applying ${item.stashEntry.name}…`, cancellable: false },
				async () => gitService.applyStash(item.stashEntry.index)
			);

			// 3c: Conflict detection
			if (result.success && result.conflicts) {
				vscode.window.showWarningMessage(
					`Applied ${item.stashEntry.name} with merge conflicts. Resolve them manually.`
				);
			} else if (result.success) {
				vscode.window.showInformationMessage(`Applied ${item.stashEntry.name}`);
			} else {
				vscode.window.showErrorMessage(`Failed to apply stash: ${result.message}`);
			}
			stashProvider.refresh('post-command');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('mystash.pop', async (item?: StashItem) => {
			if (!item) {
				const entry = await pickStash(gitService, 'Select a stash to pop');
				if (!entry) { return; }
				item = new StashItem(entry);
			}

			// 4d: Progress indicator
			const result = await vscode.window.withProgress(
				{ location: vscode.ProgressLocation.Notification, title: `Popping ${item.stashEntry.name}…`, cancellable: false },
				async () => gitService.popStash(item.stashEntry.index)
			);

			// 4c: Conflict detection — stash remains in list on conflict
			if (result.success && result.conflicts) {
				vscode.window.showWarningMessage(
					`Stash applied with conflicts but was NOT removed. Resolve conflicts, then drop manually.`
				);
			} else if (result.success) {
				vscode.window.showInformationMessage(`Popped ${item.stashEntry.name}`);
			} else {
				vscode.window.showErrorMessage(`Failed to pop stash: ${result.message}`);
			}
			stashProvider.refresh('post-command');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('mystash.drop', async (item?: StashItem) => {
			if (!item) {
				const entry = await pickStash(gitService, 'Select a stash to drop');
				if (!entry) { return; }
				item = new StashItem(entry);
			}

			// 9a-ii: Respect confirmOnDrop setting
			if (getConfig<boolean>('confirmOnDrop', true)) {
				const confirm = await vscode.window.showWarningMessage(
					`Are you sure you want to drop ${item.stashEntry.name}?`,
					{ modal: true },
					'Yes', 'No'
				);

				if (confirm !== 'Yes') {
					return;
				}
			}

			try {
				await gitService.dropStash(item.stashEntry.index);
				vscode.window.showInformationMessage(`Dropped ${item.stashEntry.name}`);
				stashProvider.refresh('post-command');
			} catch (error: any) {
				vscode.window.showErrorMessage(`Failed to drop stash: ${error.message}`);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('mystash.show', async (item?: StashItem) => {
			if (!item) {
				const entry = await pickStash(gitService, 'Select a stash to show');
				if (!entry) { return; }
				item = new StashItem(entry);
			}

			try {
				const diff = await gitService.getStashDiff(item.stashEntry.index);
				const document = await vscode.workspace.openTextDocument({
					content: diff,
					language: 'diff'
				});
				await vscode.window.showTextDocument(document, { preview: true });
			} catch (error: any) {
				vscode.window.showErrorMessage(`Failed to show stash: ${error.message}`);
			}
		})
	);

	// 6c: Per-file diff command — opens side-by-side diff editor
	context.subscriptions.push(
		vscode.commands.registerCommand('mystash.showFile', async (fileItem?: StashFileItem) => {
			if (!fileItem) { return; }

			const index = fileItem.stashIndex;
			const filePath = fileItem.filePath;
			const fileName = filePath.split('/').pop() ?? filePath;

			// Build URIs for the parent (before) and stash (after) versions
			const parentUri = vscode.Uri.parse(
				`mystash:/${filePath}?ref=parent&index=${index}`
			);
			const stashUri = vscode.Uri.parse(
				`mystash:/${filePath}?ref=stash&index=${index}`
			);

			const title = `${fileName} (stash@{${index}})`;

			try {
				await vscode.commands.executeCommand('vscode.diff', parentUri, stashUri, title, {
					preview: true
				});
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : 'Unknown error';
				vscode.window.showErrorMessage(`Failed to show file diff: ${message}`);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('mystash.openPanel', () => {
			StashPanel.createOrShow(context.extensionUri, gitService);
		})
	);

	// 6f: Show stash summary (stat view)
	context.subscriptions.push(
		vscode.commands.registerCommand('mystash.showStats', async (item?: StashItem) => {
			if (!item) {
				const entry = await pickStash(gitService, 'Select a stash to show stats for');
				if (!entry) { return; }
				item = new StashItem(entry);
			}

			try {
				const { stdout, exitCode } = await gitService.execGitPublic(
					`stash show --stat "stash@{${item.stashEntry.index}}"`
				);
				if (exitCode !== 0 || !stdout) {
					vscode.window.showInformationMessage('No stats available for this stash.');
					return;
				}
				const header = `Stash: ${item.stashEntry.name} — ${item.stashEntry.message}\nBranch: ${item.stashEntry.branch}\n${'─'.repeat(60)}\n`;
				const document = await vscode.workspace.openTextDocument({
					content: header + stdout,
					language: 'plaintext'
				});
				await vscode.window.showTextDocument(document, { preview: true });
			} catch (error: unknown) {
				const msg = error instanceof Error ? error.message : 'Unknown error';
				vscode.window.showErrorMessage(`Failed to show stash stats: ${msg}`);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('mystash.clear', async () => {
			const stashes = await gitService.getStashList();
			if (stashes.length === 0) {
				vscode.window.showInformationMessage('No stashes to clear');
				return;
			}

			// 9a-ii: Respect confirmOnClear setting
			if (getConfig<boolean>('confirmOnClear', true)) {
				const confirm = await vscode.window.showWarningMessage(
					`Are you sure you want to clear all ${stashes.length} stash(es)? This cannot be undone.`,
					{ modal: true },
					'Yes', 'No'
				);

				if (confirm !== 'Yes') {
					return;
				}
			}

			try {
				await gitService.clearStashes();
				vscode.window.showInformationMessage('All stashes cleared');
				stashProvider.refresh('post-command');
			} catch (error: any) {
				vscode.window.showErrorMessage(`Failed to clear stashes: ${error.message}`);
			}
		})
	);
}

export function deactivate() {}
