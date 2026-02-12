import * as vscode from 'vscode';
import { GitService } from './gitService';
import { StashProvider } from './stashProvider';
import { StashItem } from './stashItem';
import { pickStash } from './uiUtils';

export function activate(context: vscode.ExtensionContext) {
	console.log('MyStash extension is now active!');

	// 0b-i: Create output channel for diagnostics
	const outputChannel = vscode.window.createOutputChannel('MyStash');
	context.subscriptions.push(outputChannel);

	const gitService = new GitService(outputChannel);
	const stashProvider = new StashProvider(gitService, outputChannel);

	// Register the tree view
	const treeView = vscode.window.createTreeView('mystashView', {
		treeDataProvider: stashProvider,
		showCollapseAll: true
	});
	context.subscriptions.push(treeView);

	// Register commands
	context.subscriptions.push(
		vscode.commands.registerCommand('mystash.refresh', () => {
			stashProvider.refresh('manual');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('mystash.stash', async () => {
			const message = await vscode.window.showInputBox({
				prompt: 'Enter stash message (optional)',
				placeHolder: 'Stash message'
			});

			const includeUntracked = await vscode.window.showQuickPick(['No', 'Yes'], {
				placeHolder: 'Include untracked files?'
			});

			try {
				await gitService.createStash(message, includeUntracked === 'Yes');
				vscode.window.showInformationMessage('Stash created successfully');
				stashProvider.refresh('post-command');
			} catch (error: any) {
				vscode.window.showErrorMessage(`Failed to create stash: ${error.message}`);
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

			try {
				await gitService.applyStash(item.stashEntry.index);
				vscode.window.showInformationMessage(`Applied ${item.stashEntry.name}`);
				stashProvider.refresh('post-command');
			} catch (error: any) {
				vscode.window.showErrorMessage(`Failed to apply stash: ${error.message}`);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('mystash.pop', async (item?: StashItem) => {
			if (!item) {
				const entry = await pickStash(gitService, 'Select a stash to pop');
				if (!entry) { return; }
				item = new StashItem(entry);
			}

			try {
				await gitService.popStash(item.stashEntry.index);
				vscode.window.showInformationMessage(`Popped ${item.stashEntry.name}`);
				stashProvider.refresh('post-command');
			} catch (error: any) {
				vscode.window.showErrorMessage(`Failed to pop stash: ${error.message}`);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('mystash.drop', async (item?: StashItem) => {
			if (!item) {
				const entry = await pickStash(gitService, 'Select a stash to drop');
				if (!entry) { return; }
				item = new StashItem(entry);
			}

			const confirm = await vscode.window.showWarningMessage(
				`Are you sure you want to drop ${item.stashEntry.name}?`,
				{ modal: true },
				'Yes', 'No'
			);

			if (confirm !== 'Yes') {
				return;
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

	context.subscriptions.push(
		vscode.commands.registerCommand('mystash.clear', async () => {
			const stashes = await gitService.getStashList();
			if (stashes.length === 0) {
				vscode.window.showInformationMessage('No stashes to clear');
				return;
			}

			const confirm = await vscode.window.showWarningMessage(
				`Are you sure you want to clear all ${stashes.length} stash(es)? This cannot be undone.`,
				{ modal: true },
				'Yes', 'No'
			);

			if (confirm !== 'Yes') {
				return;
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
