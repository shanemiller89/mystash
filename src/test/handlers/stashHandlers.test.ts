import * as assert from 'assert';
import * as vscode from 'vscode';
import { GitService, ExecFn } from '../../gitService';
import { handleStashMessage } from '../../handlers/stashHandlers';
import type { HandlerContext, WebviewMessage } from '../../handlers/types';

/**
 * Unit tests for stash message handlers (§16a).
 *
 * Uses a mock `HandlerContext` with a real `GitService` backed by a mock exec
 * function, plus stubs for `postMessage`, `refresh`, etc.
 */

// ─── Helpers ──────────────────────────────────────────────────────

/** Create a mock ExecFn that returns predetermined output */
function mockExec(responses: { stdout: string; stderr?: string }[]): ExecFn & { calls: string[] } {
    let callIndex = 0;
    const calls: string[] = [];
    const fn = (async (command: string, _options: { cwd: string }) => {
        calls.push(command);
        const resp = responses[callIndex++];
        if (!resp) {
            throw Object.assign(new Error('Mock: no more responses'), {
                stdout: '',
                stderr: 'mock error',
                code: 1,
            });
        }
        return { stdout: resp.stdout, stderr: resp.stderr ?? '' };
    }) as ExecFn & { calls: string[] };
    fn.calls = calls;
    return fn;
}

interface MockCtxOptions {
    exec?: ExecFn;
}

interface MockContext {
    ctx: HandlerContext;
    messages: Record<string, unknown>[];
    refreshCalls: number;
}

function createMockContext(opts: MockCtxOptions = {}): MockContext {
    const messages: Record<string, unknown>[] = [];
    let refreshCalls = 0;

    const exec = opts.exec ?? mockExec([{ stdout: '' }]);
    const gitService = new GitService('/fake/root', undefined, exec);
    const outputChannel = vscode.window.createOutputChannel('Test');

    const ctx: HandlerContext = {
        postMessage: (msg) => { messages.push(msg); },
        outputChannel,
        gitService,
        authService: undefined,
        gistService: undefined,
        prService: undefined,
        issueService: undefined,
        mattermostService: undefined,
        projectService: undefined,
        driveService: undefined,
        calendarService: undefined,
        wikiService: undefined,
        aiService: undefined as unknown as HandlerContext['aiService'],
        getRepoInfo: async () => undefined,
        refresh: async () => { refreshCalls++; },
        sendAuthStatus: async () => { /* stub */ },
        sendRepoContext: async () => { /* stub */ },
        fetchUserRepos: async () => { /* stub */ },
        refreshNotes: async () => { /* stub */ },
        refreshPRs: async () => { /* stub */ },
        sendPRComments: async () => { /* stub */ },
        refreshIssues: async () => { /* stub */ },
        sendIssueComments: async () => { /* stub */ },
        refreshProjects: async () => { /* stub */ },
        refreshProjectItems: async () => { /* stub */ },
        refreshMattermost: async () => { /* stub */ },
        refreshWiki: async () => { /* stub */ },
        sendDriveAuthStatus: async () => { /* stub */ },
        sendCalendarAuthStatus: async () => { /* stub */ },
        gatherContext: async () => '',
        getMmWebSocket: () => undefined,
        setMmWebSocket: () => { /* stub */ },
        connectMattermostWebSocket: async () => { /* stub */ },
        getRepoOverride: () => undefined,
        setRepoOverride: () => { /* stub */ },
    };

    return {
        ctx,
        get messages() { return messages; },
        get refreshCalls() { return refreshCalls; },
    };
}

// ─── Tests ────────────────────────────────────────────────────────

suite('Stash Handler Tests (§16a)', () => {
    test('refresh message calls ctx.refresh() and returns true', async () => {
        const mock = createMockContext();
        const handled = await handleStashMessage(mock.ctx, { type: 'refresh' });
        assert.strictEqual(handled, true);
        assert.strictEqual(mock.refreshCalls, 1);
    });

    test('unknown message type returns false', async () => {
        const mock = createMockContext();
        const handled = await handleStashMessage(mock.ctx, { type: 'nonexistent.message' });
        assert.strictEqual(handled, false);
    });

    test('ready message returns false (handled by StashPanel)', async () => {
        const mock = createMockContext();
        const handled = await handleStashMessage(mock.ctx, { type: 'ready' });
        assert.strictEqual(handled, false);
    });

    test('getFileDiff posts fileDiff message with diff content', async () => {
        const exec = mockExec([
            { stdout: 'diff --git a/file.ts b/file.ts\n+added line\n-removed line' },
        ]);
        const mock = createMockContext({ exec });

        const handled = await handleStashMessage(mock.ctx, {
            type: 'getFileDiff',
            index: 0,
            filePath: 'src/file.ts',
        });

        assert.strictEqual(handled, true);
        assert.strictEqual(mock.messages.length, 1);
        assert.strictEqual(mock.messages[0].type, 'fileDiff');
        assert.strictEqual(mock.messages[0].key, '0:src/file.ts');
        assert.ok(typeof mock.messages[0].diff === 'string');
    });

    test('getFileDiff posts empty diff on error', async () => {
        const exec = mockExec([]); // Will throw — no responses available
        const mock = createMockContext({ exec });

        const handled = await handleStashMessage(mock.ctx, {
            type: 'getFileDiff',
            index: 0,
            filePath: 'src/file.ts',
        });

        assert.strictEqual(handled, true);
        assert.strictEqual(mock.messages.length, 1);
        assert.strictEqual(mock.messages[0].type, 'fileDiff');
        assert.strictEqual(mock.messages[0].diff, '');
    });

    test('apply with missing index still returns true (no-op)', async () => {
        const mock = createMockContext();
        const handled = await handleStashMessage(mock.ctx, { type: 'apply' });
        assert.strictEqual(handled, true);
        // No refresh should be called since index is undefined
        assert.strictEqual(mock.refreshCalls, 0);
    });

    test('apply with valid index calls refresh', async () => {
        // GitService.applyStash calls execGit twice: git stash apply, then checks for conflicts
        const exec = mockExec([
            { stdout: '' }, // git stash apply
        ]);
        const mock = createMockContext({ exec });

        const handled = await handleStashMessage(mock.ctx, { type: 'apply', index: 0 });
        assert.strictEqual(handled, true);
        assert.strictEqual(mock.refreshCalls, 1);
    });

    test('pop with valid index calls refresh', async () => {
        const exec = mockExec([
            { stdout: '' }, // git stash pop
        ]);
        const mock = createMockContext({ exec });

        const handled = await handleStashMessage(mock.ctx, { type: 'pop', index: 0 });
        assert.strictEqual(handled, true);
        assert.strictEqual(mock.refreshCalls, 1);
    });

    test('createStashInline with message calls refresh', async () => {
        const exec = mockExec([
            { stdout: '' }, // git stash push
        ]);
        const mock = createMockContext({ exec });

        const handled = await handleStashMessage(mock.ctx, {
            type: 'createStashInline',
            message: 'test stash',
            mode: 'all',
        });
        assert.strictEqual(handled, true);
        assert.strictEqual(mock.refreshCalls, 1);
    });

    test('handler correctly routes multiple message types', async () => {
        const mock = createMockContext();

        // These should all return true (handled)
        const handledTypes = ['refresh', 'apply', 'pop', 'drop', 'showFile', 'getFileDiff',
            'createStash', 'createStashInline', 'clearStashes', 'switchRepo', 'fetchUserRepos'];

        for (const type of handledTypes) {
            const result = await handleStashMessage(mock.ctx, { type });
            assert.strictEqual(result, true, `Handler should return true for message type "${type}"`);
        }

        // Unknown messages should return false
        const unhandled = await handleStashMessage(mock.ctx, { type: 'prs.load' });
        assert.strictEqual(unhandled, false, 'Handler should return false for unrelated message types');
    });
});
