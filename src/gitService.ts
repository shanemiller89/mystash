import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GitResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

export interface StashEntry {
    index: number;
    name: string;
    branch: string;
    message: string;
}

export class GitService {
    private workspaceRoot: string | undefined;
    private _outputChannel: vscode.OutputChannel | undefined;

    constructor(outputChannel?: vscode.OutputChannel) {
        this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        this._outputChannel = outputChannel;
        // TODO: multi-root — accept workspaceRoot as parameter instead of hardcoding [0]
    }

    private async execGit(command: string): Promise<GitResult> {
        if (!this.workspaceRoot) {
            return { stdout: '', stderr: 'No workspace folder open', exitCode: 1 };
        }

        this._outputChannel?.appendLine(`[GIT] git ${command}`);

        try {
            const { stdout, stderr } = await execAsync(`git ${command}`, {
                cwd: this.workspaceRoot
            });
            this._outputChannel?.appendLine(`[GIT] exit 0`);
            return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 };
        } catch (error: unknown) {
            const err = error as { stdout?: string; stderr?: string; code?: unknown; message?: string };
            const exitCode = typeof err.code === 'number' ? err.code : 1;
            const stdout = (err.stdout ?? '').trim();
            const stderr = (err.stderr ?? err.message ?? 'Unknown git error').trim();
            this._outputChannel?.appendLine(`[GIT] exit ${exitCode}`);
            if (stderr) {
                this._outputChannel?.appendLine(`[GIT] stderr: ${stderr}`);
            }
            return { stdout, stderr, exitCode };
        }
    }

    async getStashList(): Promise<StashEntry[]> {
        const { stdout, exitCode } = await this.execGit('stash list');
        if (exitCode !== 0 || !stdout) {
            return [];
        }

        return stdout.split('\n').map((line, index) => {
            // Format: stash@{0}: On branch-name: message
            // or: stash@{0}: WIP on branch-name: commit-hash message
            const match = line.match(/stash@\{(\d+)\}:\s*(?:WIP\s+)?(?:On\s+)?([^:]+):\s*(.*)/);
            if (match) {
                return {
                    index: parseInt(match[1], 10),
                    name: `stash@{${match[1]}}`,
                    branch: match[2].trim(),
                    message: match[3].trim() || 'No message'
                };
            }
            return {
                index,
                name: `stash@{${index}}`,
                branch: 'unknown',
                message: line
            };
        });
    }

    async createStash(message?: string, includeUntracked: boolean = false): Promise<void> {
        let command = 'stash push';
        if (includeUntracked) {
            command += ' --include-untracked';
        }
        if (message) {
            command += ` -m "${message}"`;
        }
        const { stderr, exitCode } = await this.execGit(command);
        if (exitCode !== 0) {
            throw new Error(stderr || 'Failed to create stash');
        }
    }

    async applyStash(index: number): Promise<void> {
        const { stderr, exitCode } = await this.execGit(`stash apply stash@{${index}}`);
        if (exitCode !== 0) {
            throw new Error(stderr || 'Failed to apply stash');
        }
    }

    async popStash(index: number): Promise<void> {
        const { stderr, exitCode } = await this.execGit(`stash pop stash@{${index}}`);
        if (exitCode !== 0) {
            throw new Error(stderr || 'Failed to pop stash');
        }
    }

    async dropStash(index: number): Promise<void> {
        const { stderr, exitCode } = await this.execGit(`stash drop stash@{${index}}`);
        if (exitCode !== 0) {
            throw new Error(stderr || 'Failed to drop stash');
        }
    }

    async clearStashes(): Promise<void> {
        const { stderr, exitCode } = await this.execGit('stash clear');
        if (exitCode !== 0) {
            throw new Error(stderr || 'Failed to clear stashes');
        }
    }

    async getStashDiff(index: number): Promise<string> {
        const { stdout, stderr, exitCode } = await this.execGit(`stash show -p stash@{${index}}`);
        if (exitCode !== 0) {
            throw new Error(stderr || 'Failed to get stash diff');
        }
        return stdout;
    }

    async getStashFiles(index: number): Promise<string[]> {
        const { stdout, stderr, exitCode } = await this.execGit(`stash show --name-only stash@{${index}}`);
        if (exitCode !== 0) {
            throw new Error(stderr || 'Failed to get stash files');
        }
        return stdout.split('\n').filter(line => line.trim());
    }

    async isGitRepository(): Promise<boolean> {
        const { exitCode } = await this.execGit('rev-parse --is-inside-work-tree');
        return exitCode === 0;
    }
}
