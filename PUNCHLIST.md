# MyStash — Development Punch List

> Feature tracker for the MyStash VS Code extension.
> ✅ = done, 🔲 = todo. Check off items as they are completed.
>
> **Architecture decisions (locked):**
> - `execGit()` returns `{ stdout, stderr, exitCode }` (structured result, not throw-on-error)
> - Diff viewing uses `TextDocumentContentProvider` with `mystash:` URI scheme (no temp files)
> - Multi-root workspace is Phase 2 but design placeholders (`// TODO: multi-root`) are added now
> - Extract `pickStash()` helper to eliminate QuickPick boilerplate duplication
> - Both unit tests (mocked exec) and integration tests (extension host)

---

## 0. 🏗️ Refactors & Infrastructure

> Foundational changes that unblock multiple features. Do these first.

### 0A. `execGit()` Structured Return

- [x] **0a-i. Define `GitResult` interface**
  - `interface GitResult { stdout: string; stderr: string; exitCode: number }`
  - 📁 `gitService.ts`

- [x] **0a-ii. Refactor `execGit()` to return `GitResult`**
  - Wrap `execAsync()` in try/catch; on success return `{ stdout, stderr: '', exitCode: 0 }`
  - On error, extract `error.code` (exit code), `error.stderr`, `error.stdout`
  - **Do NOT throw** — callers decide what exit codes mean
  - Update signature: `private async execGit(command: string): Promise<GitResult>`
  - 📁 `gitService.ts`

- [x] **0a-iii. Update all existing callers**
  - Every method that calls `execGit()` must destructure `{ stdout, stderr, exitCode }`
  - For methods that previously relied on throw-on-error:
    - `getStashList()` — check `exitCode !== 0`, return `[]`
    - `createStash()` — throw `new Error(stderr)` if `exitCode !== 0`
    - `applyStash()` / `popStash()` — **do not throw on exit code 1** (conflict case, handled in 3c/4c)
    - `dropStash()` / `clearStashes()` — throw if `exitCode !== 0`
    - `getStashDiff()` / `getStashFiles()` — throw if `exitCode !== 0`
    - `isGitRepository()` — return `exitCode === 0`
  - 📁 `gitService.ts`
  - ⚠️ **Blocks:** 3c, 4c (conflict detection depends on structured return)

### 0B. Output Channel

- [x] **0b-i. Create output channel**
  - `const outputChannel = vscode.window.createOutputChannel('MyStash')`
  - Create in `activate()`, push to `context.subscriptions`
  - 📁 `extension.ts`

- [x] **0b-ii. Pass output channel to `GitService`**
  - Add optional `outputChannel?: vscode.OutputChannel` constructor param
  - In `execGit()`, log: `[GIT] git ${command}` before exec, `[GIT] exit ${exitCode}` after
  - On error: log full stderr
  - 📁 `gitService.ts`

- [x] **0b-iii. Log refresh triggers**
  - Log in `StashProvider.refresh()`: `[REFRESH] triggered by: ${reason}`
  - Add `reason` parameter to `refresh(reason: string = 'manual')`
  - Log reasons: `'manual'`, `'git-watcher'`, `'window-focus'`, `'post-command'`
  - 📁 `stashProvider.ts`, `extension.ts`

### 0C. `pickStash()` Helper

- [x] **0c-i. Extract `pickStash()` utility function**
  - Signature: `async function pickStash(gitService: GitService, prompt: string): Promise<StashEntry | undefined>`
  - Logic: fetch stash list → return `undefined` + show info message if empty → show QuickPick → return selected `StashEntry` or `undefined` if cancelled
  - 📁 `uiUtils.ts`

- [x] **0c-ii. Replace duplicated blocks in apply/pop/drop/show**
  - Each command's `if (!item) { ... }` block → single `pickStash()` call
  - Verify: all 4 commands work identically after refactor
  - 📁 `extension.ts`
  - ⚠️ **Depends on:** 0c-i

---

## 1. 🗂️ Display Stash List

> Show all user stashes in the sidebar tree view with rich details.

### 1A. Git Layer — Stash Data

- [x] **1a-i. Basic `getStashList()` method**
  - Runs `git stash list`, parses output into `StashEntry[]`
  - 📁 `gitService.ts`

- [ ] **1a-ii. Robust stash line parsing**
  - Replace current regex with one that handles all formats:
    - `stash@{0}: On main: my message` → branch=`main`, message=`my message`
    - `stash@{0}: WIP on main: abc1234 commit msg` → branch=`main`, message=`abc1234 commit msg`
    - `stash@{0}: On (no branch): message` → branch=`(no branch)`, message=`message`
    - `stash@{0}: WIP on main: abc1234` (no user message) → branch=`main`, message=`(no message)`
  - Updated regex: `/stash@\{(\d+)\}:\s*(?:WIP on|On)\s+(.+?):\s*(.*)/`
  - Fallback: if regex fails, set `branch='unknown'`, `message=<raw line>` (never crash)
  - Detect empty/WIP-only messages: if `message` matches `/^[a-f0-9]{7,}\s/`, set display to `(no message)`
  - 📁 `gitService.ts`
  - ✅ **Test coverage:** 9a-i

- [ ] **1a-iii. Add date/time to `StashEntry`**
  - Change git command to: `git stash list --format="%gd|%ai|%gs"`
  - Format produces: `stash@{0}|2026-02-10 14:23:05 -0600|On main: my message`
  - Parse with `line.split('|')` (3 segments: ref, ISO date, subject)
  - Re-parse the subject segment with the same regex from 1a-ii
  - Add to `StashEntry` interface: `date: Date`
  - Construct: `new Date(isoDateString)`
  - 📁 `gitService.ts`
  - ⚠️ **Depends on:** 1a-ii (same parsing logic, extended)
  - ✅ **Test coverage:** 9a-ii

- [ ] **1a-iv. Add file stats to `StashEntry`**
  - Run: `git stash show --stat stash@{n}` → last line is `N files changed, N insertions(+), N deletions(-)`
  - Parse last line regex: `/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/`
  - Add to `StashEntry`: `stats?: { filesChanged: number; insertions: number; deletions: number }`
  - **Lazy-load strategy:** Don't fetch stats in `getStashList()` (too many git calls). Fetch on-demand when building tooltip or on first expand.
  - Add method: `async getStashStats(index: number): Promise<StashEntry['stats']>`
  - 📁 `gitService.ts`
  - ✅ **Test coverage:** 9a-iii

- [x] **1a-v. `getStashFiles()` method**
  - Runs `git stash show --name-only stash@{n}`
  - Returns `string[]` of file paths
  - 📁 `gitService.ts`

- [ ] **1a-vi. `getStashFilesWithStatus()` method**
  - Runs: `git stash show --name-status stash@{n}`
  - Output format: `M\tsrc/extension.ts`, `A\tnew-file.ts`, `D\told-file.ts`
  - Returns: `{ path: string; status: 'M' | 'A' | 'D' | 'R' | 'C' }[]`
  - Rename existing `getStashFiles()` callers to use this (or keep both, with `getStashFiles()` as thin wrapper)
  - 📁 `gitService.ts`
  - ⚠️ **Depends on:** 0a (needs structured `GitResult`)
  - ✅ **Test coverage:** 9a-iv

- [ ] **1a-vii. `getStashFileContent()` method**
  - Runs: `git show stash@{n}:<filepath>`
  - Returns raw file content (string) — used by `TextDocumentContentProvider` in 6d
  - 📁 `gitService.ts`
  - ⚠️ **Depends on:** 0a (needs structured `GitResult`)

- [ ] **1a-viii. `getStashFileDiff()` method**
  - Runs: `git stash show -p stash@{n} -- <filepath>`
  - Returns diff string for a single file within a stash
  - 📁 `gitService.ts`
  - ⚠️ **Depends on:** 0a

- [x] **1a-ix. `isGitRepository()` check**
  - Runs `git rev-parse --is-inside-work-tree`
  - Returns boolean
  - 📁 `gitService.ts`

- [ ] **1a-x. `hasChanges()` method**
  - Runs: `git status --porcelain`
  - Returns `boolean` — `true` if output is non-empty
  - Used by 2c (no-changes guard)
  - 📁 `gitService.ts`

### 1B. Tree Item Models — List UI

- [x] **1b-i. Basic `StashItem` class**
  - Extends `TreeItem`, message as label, `contextValue = 'stashItem'`
  - 📁 `stashItem.ts`

- [ ] **1b-ii. Rich `StashItem` display**
  - **Label**: Stash message or `"(no message)"` if empty/WIP-only
  - **Description**: `stash@{n}` + (conditionally) ` · branch-name` based on `mystash.showBranchInDescription` setting
  - **Tooltip** (`new vscode.MarkdownString()`):
    ```
    **stash@{0}**
    Branch: `main`
    Date: 2 hours ago
    Files: 3 changed (+12 −5)
    ```
  - **Icon**: `new vscode.ThemeIcon('archive')`
  - `collapsibleState = vscode.TreeItemCollapsibleState.Collapsed`
  - Read settings: `vscode.workspace.getConfiguration('mystash').get<boolean>('showBranchInDescription', true)`
  - 📁 `stashItem.ts`
  - ⚠️ **Depends on:** 1a-iii (date), 1a-iv (stats), 8e (settings)

- [ ] **1b-iii. `formatRelativeTime()` helper**
  - Signature: `formatRelativeTime(date: Date): string`
  - Logic (cascade):
    - `< 60s` → `"just now"`
    - `< 60m` → `"N min ago"`
    - `< 24h` → `"N hours ago"`
    - `< 7d` → `"N days ago"`
    - `< 365d` → `"Mon DD"` (e.g. `"Feb 10"`)
    - `>= 365d` → `"Mon DD, YYYY"` (e.g. `"Jan 15, 2025"`)
  - Pure function, no dependencies — can be implemented anytime
  - 📁 new `src/utils.ts`
  - ✅ **Test coverage:** 9b-i

- [x] **1b-iv. Basic `StashFileItem` class**
  - Extends `TreeItem`, file path as label, file icon
  - 📁 `stashItem.ts`

- [ ] **1b-v. Rich `StashFileItem` display**
  - **Label**: filename only — `path.basename(filePath)` (e.g. `extension.ts`)
  - **Description**: parent directory — `path.dirname(filePath)` (e.g. `src/`)
  - **Icon**: Based on file status (see 1b-vi)
  - **`command` property**: Wire click to open per-file diff:
    ```ts
    this.command = {
      command: 'mystash.showFile',
      title: 'Show File Diff',
      arguments: [this]
    };
    ```
  - Add `import * as path from 'path'` to `stashItem.ts`
  - 📁 `stashItem.ts`
  - ⚠️ **Depends on:** 6c (`mystash.showFile` command must exist for click to work)

- [ ] **1b-vi. File status indicators**
  - Accept `status: 'M' | 'A' | 'D' | 'R' | 'C'` in `StashFileItem` constructor
  - Icon map:
    - `M` → `new vscode.ThemeIcon('diff-modified', new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'))`
    - `A` → `new vscode.ThemeIcon('diff-added', new vscode.ThemeColor('gitDecoration.addedResourceForeground'))`
    - `D` → `new vscode.ThemeIcon('diff-removed', new vscode.ThemeColor('gitDecoration.deletedResourceForeground'))`
    - `R` / `C` → `new vscode.ThemeIcon('diff-renamed')`
  - Description suffix: `src/ · Modified` (status word after path)
  - 📁 `stashItem.ts`
  - ⚠️ **Depends on:** 1a-vi (`getStashFilesWithStatus()`)

### 1C. Tree Data Provider

- [x] **1c-i. Basic `StashProvider` class**
  - Implements `TreeDataProvider`, `onDidChangeTreeData` event, `refresh()` method
  - 📁 `stashProvider.ts`

- [x] **1c-ii. `getChildren()` — root level**
  - Returns `StashItem[]` from `gitService.getStashList()`
  - Sets `collapsibleState = Collapsed`
  - 📁 `stashProvider.ts`

- [x] **1c-iii. `getChildren()` — child level**
  - When parent is `StashItem`, returns `StashFileItem[]` from `getStashFiles()`
  - 📁 `stashProvider.ts`

- [ ] **1c-iv. Set `mystash.hasStashes` context key**
  - After fetching stash list in `getChildren()` (root level):
    ```ts
    vscode.commands.executeCommand('setContext', 'mystash.hasStashes', stashes.length > 0);
    vscode.commands.executeCommand('setContext', 'mystash.isGitRepo', true);
    ```
  - On "not a git repo" path: `setContext('mystash.isGitRepo', false)`
  - These keys drive the welcome view `when` clauses (1d-iv)
  - 📁 `stashProvider.ts`
  - ⚠️ **Blocks:** 1d-iv (welcome view depends on context keys)

- [ ] **1c-v. Remove toast notifications from `getChildren()`**
  - **Current bug**: `showInformationMessage('Not a git repository')` fires on every tree refresh
  - Remove both `showInformationMessage` calls from `getChildren()`
  - Replace with: return `[]` and let the welcome view (1d-iv) handle messaging
  - For errors in child fetch: return `[new ErrorTreeItem('Failed to load files')]` or `[]`
  - 📁 `stashProvider.ts`
  - ⚠️ **Depends on:** 1d-iv (welcome view must exist to replace toasts)

- [ ] **1c-vi. Debounced refresh guard**
  - Add private `_refreshTimer: ReturnType<typeof setTimeout> | undefined`
  - `refresh()` clears existing timer, sets new one with 300ms delay
  - Prevents rapid-fire refreshes from file watcher events
  - Add `_isRefreshing: boolean` guard to prevent overlapping `getChildren()` calls
  - 📁 `stashProvider.ts`

- [ ] **1c-vii. Use `getStashFilesWithStatus()` in child level**
  - Update `getChildren()` for `StashItem` parent to call `getStashFilesWithStatus()`
  - Pass status to `StashFileItem` constructor
  - Respects `mystash.showFileStatus` setting — if disabled, use `getStashFiles()` instead
  - 📁 `stashProvider.ts`
  - ⚠️ **Depends on:** 1a-vi, 1b-vi, 8e

### 1D. View Registration & package.json

- [x] **1d-i. Activity bar container**
  - `viewsContainers.activitybar` with `$(archive)` icon
  - 📁 `package.json`

- [x] **1d-ii. View declaration**
  - `mystashView` under `mystash-container`
  - 📁 `package.json`

- [x] **1d-iii. Tree view creation in `activate()`**
  - `vscode.window.createTreeView()` with `showCollapseAll: true`
  - 📁 `extension.ts`

- [ ] **1d-iv. Welcome view (empty state)**
  - Add `viewsWelcome` contribution to `package.json`:
    ```json
    "viewsWelcome": [
      {
        "view": "mystashView",
        "contents": "No stashes found.\n[Create Stash](command:mystash.stash)",
        "when": "mystash.isGitRepo && !mystash.hasStashes"
      },
      {
        "view": "mystashView",
        "contents": "Open a folder with a git repository to manage stashes.",
        "when": "!mystash.isGitRepo"
      }
    ]
    ```
  - 📁 `package.json`
  - ⚠️ **Depends on:** 1c-iv (context keys must be set)

- [ ] **1d-v. View badge (stash count)**
  - In `StashProvider` or `extension.ts`, after refresh:
    ```ts
    treeView.badge = { value: stashCount, tooltip: `${stashCount} stash(es)` };
    ```
  - Set `badge = undefined` when count is 0 (hides badge)
  - Need `treeView` reference accessible from provider (pass in constructor or use event)
  - 📁 `extension.ts`

- [ ] **1d-vi. View title dynamic text**
  - After refresh, update: `treeView.title = stashCount > 0 ? \`Git Stashes (${stashCount})\` : 'Git Stashes'`
  - 📁 `extension.ts`

### 1E. Refresh & Reactivity

- [x] **1e-i. Manual refresh command**
  - `mystash.refresh` command registered, calls `stashProvider.refresh()`
  - Refresh button in view title bar
  - 📁 `extension.ts`, `package.json`

- [ ] **1e-ii. Auto-refresh on git changes**
  - Create watchers (respect `mystash.autoRefresh` setting):
    ```ts
    const gitStashWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceRoot, '.git/refs/stash')
    );
    const gitStashLogWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceRoot, '.git/logs/refs/stash')
    );
    ```
  - On `onDidChange`, `onDidCreate`, `onDidDelete` → `stashProvider.refresh('git-watcher')`
  - Push watchers to `context.subscriptions`
  - Guard: skip if `mystash.autoRefresh` is `false`
  - 📁 `extension.ts`
  - ⚠️ **Depends on:** 8e (setting), 0b (logging), 1c-vi (debounce)

- [ ] **1e-iii. Auto-refresh on window focus**
  - ```ts
    vscode.window.onDidChangeWindowState(state => {
      if (state.focused) {
        stashProvider.refresh('window-focus');
      }
    });
    ```
  - Guard: skip if `mystash.autoRefresh` is `false`
  - 📁 `extension.ts`
  - ⚠️ **Depends on:** 8e (setting)

- [ ] **1e-iv. // TODO: multi-root watcher support**
  - Currently watchers target `workspaceFolders[0]` only
  - Add `// TODO: multi-root — create watchers for each workspace folder`
  - 📁 `extension.ts`

---

## 2. ➕ Create Stash

> Create a new stash from current changes.

- [x] **2a. Stash with message prompt**
  - `InputBox` for optional message → `git stash push -m "message"`
  - Refresh tree on success
  - 📁 `extension.ts`, `gitService.ts`

- [x] **2b. Include untracked files option**
  - `QuickPick` Yes/No → `--include-untracked` flag
  - 📁 `extension.ts`, `gitService.ts`

- [ ] **2c. Handle no-changes edge case**
  - Before showing InputBox, call `gitService.hasChanges()`
  - If `false`: `showInformationMessage('No local changes to stash')` and return
  - 📁 `extension.ts`
  - ⚠️ **Depends on:** 1a-x (`hasChanges()` method)

- [ ] **2d. Three-way stash mode QuickPick**
  - Replace the Yes/No untracked prompt with a 3-option QuickPick:
    ```ts
    const mode = await vscode.window.showQuickPick([
      { label: '$(files) All Changes', description: 'Stash all modified and staged files', value: 'all' },
      { label: '$(git-commit) Staged Only', description: 'Stash only staged changes (git 2.35+)', value: 'staged' },
      { label: '$(new-file) Include Untracked', description: 'Also stash untracked files', value: 'untracked' }
    ], { placeHolder: 'What to stash?' });
    ```
  - Map to flags:
    - `'all'` → no extra flags
    - `'staged'` → `--staged` (remove `-m` — staged stash doesn't support message before git 2.40)
    - `'untracked'` → `--include-untracked`
  - If `mystash.defaultIncludeUntracked` setting is `true`, pre-select "Include Untracked"
  - 📁 `extension.ts`, `gitService.ts`
  - ⚠️ **Depends on:** 8e (setting)

- [ ] **2e. Cancel-safe flow**
  - **Bug fix:** Currently pressing Escape on the message InputBox returns `undefined`, but the command continues to the untracked QuickPick
  - Fix: Check `message === undefined` (Escape) vs. `message === ''` (empty submit)
    ```ts
    const message = await vscode.window.showInputBox({ ... });
    if (message === undefined) { return; }  // user cancelled
    ```
  - Also guard the mode QuickPick: `if (!mode) { return; }`
  - 📁 `extension.ts`

- [ ] **2f. Progress indicator for create**
  - Wrap the `createStash()` call in:
    ```ts
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Creating stash...' },
      () => gitService.createStash(message, flags)
    );
    ```
  - 📁 `extension.ts`

---

## 3. ✅ Apply Stash

> Apply a stash without removing it from the list.

- [x] **3a. Apply from tree view click**
  - Inline button + context menu on `StashItem`
  - 📁 `extension.ts`, `gitService.ts`

- [x] **3b. Apply from command palette**
  - `QuickPick` fallback when no tree item → will use `pickStash()` after 0c
  - 📁 `extension.ts`

- [ ] **3c. Handle merge conflicts on apply**
  - With structured `GitResult` (0a), inspect `applyStash()` return:
    ```ts
    const result = await this.execGit(`stash apply stash@{${index}}`);
    if (result.exitCode === 0) { return { success: true, conflicts: false }; }
    if (result.stderr.includes('CONFLICT') || result.stdout.includes('CONFLICT')) {
      return { success: true, conflicts: true };
    }
    throw new Error(result.stderr || 'Failed to apply stash');
    ```
  - Update `applyStash()` return type: `Promise<{ success: boolean; conflicts: boolean }>`
  - In command handler:
    - No conflicts → `showInformationMessage('Applied stash@{n}')`
    - Conflicts → `showWarningMessage('Stash applied with merge conflicts. Resolve them in the editor.')`
  - 📁 `gitService.ts`, `extension.ts`
  - ⚠️ **Depends on:** 0a-ii (structured `GitResult`)

- [ ] **3d. Progress indicator**
  - Wrap apply in `vscode.window.withProgress()`:
    ```ts
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Applying ${item.stashEntry.name}...` },
      () => gitService.applyStash(item.stashEntry.index)
    );
    ```
  - 📁 `extension.ts`

---

## 4. ⬆️ Pop Stash

> Apply a stash and remove it from the list.

- [x] **4a. Pop from tree view**
  - Context menu action → `git stash pop stash@{n}`
  - 📁 `extension.ts`, `gitService.ts`

- [x] **4b. Pop from command palette**
  - `QuickPick` fallback → will use `pickStash()` after 0c
  - 📁 `extension.ts`

- [ ] **4c. Handle conflicts on pop**
  - Same pattern as 3c but with important behavioral difference:
  - **Git behavior:** if `pop` encounters conflicts, the stash is **NOT dropped** (it remains in the list)
  - Return type: `Promise<{ success: boolean; conflicts: boolean }>`
  - In command handler on conflict: `showWarningMessage('Stash applied with conflicts but was NOT removed. Resolve conflicts, then drop it manually.')`
  - 📁 `gitService.ts`, `extension.ts`
  - ⚠️ **Depends on:** 0a-ii (structured `GitResult`)

- [ ] **4d. Progress indicator**
  - Same as 3d but for pop
  - 📁 `extension.ts`

---

## 5. 🗑️ Drop Stash

> Delete a stash permanently.

- [x] **5a. Drop with confirmation**
  - Modal warning → `git stash drop stash@{n}`
  - Respect `mystash.confirmOnDrop` setting — if `false`, skip modal
  - 📁 `extension.ts`, `gitService.ts`
  - ⚠️ **Enhance with:** 8e (setting)

- [x] **5b. Drop from command palette**
  - `QuickPick` fallback → will use `pickStash()` after 0c
  - 📁 `extension.ts`

---

## 6. 👁️ Show Stash Contents

> View the diff of a stash.

- [x] **6a. Show full stash diff**
  - `git stash show -p stash@{n}` → new editor tab with `language='diff'`
  - 📁 `extension.ts`, `gitService.ts`

- [x] **6b. Show from command palette**
  - `QuickPick` fallback → will use `pickStash()` after 0c
  - 📁 `extension.ts`

- [ ] **6c. `mystash.showFile` command — per-file diff**
  - Register new command in `extension.ts`:
    ```ts
    vscode.commands.registerCommand('mystash.showFile', async (fileItem: StashFileItem) => { ... })
    ```
  - Declare in `package.json` `commands` array:
    ```json
    { "command": "mystash.showFile", "title": "Show File Diff", "category": "MyStash" }
    ```
  - Hide from command palette (not useful without a file item):
    ```json
    { "command": "mystash.showFile", "when": "false" }
    ```
  - Implementation: call `gitService.getStashFileDiff(index, filepath)` → open in diff editor
  - 📁 `extension.ts`, `package.json`
  - ⚠️ **Depends on:** 1a-viii (`getStashFileDiff()`)

- [ ] **6d. `TextDocumentContentProvider` for stash file content**
  - Create `src/stashContentProvider.ts`:
    ```ts
    export class StashContentProvider implements vscode.TextDocumentContentProvider {
      constructor(private gitService: GitService) {}
      provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        // URI format: mystash://stash/{index}/{filepath}
        const index = parseInt(uri.authority, 10);
        const filepath = uri.path.substring(1); // remove leading /
        return this.gitService.getStashFileContent(index, filepath);
      }
    }
    ```
  - Register in `activate()`:
    ```ts
    const stashContentProvider = new StashContentProvider(gitService);
    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider('mystash', stashContentProvider)
    );
    ```
  - 📁 new `src/stashContentProvider.ts`, `extension.ts`
  - ⚠️ **Depends on:** 1a-vii (`getStashFileContent()`)

- [ ] **6e. Side-by-side diff view using `vscode.diff`**
  - In `mystash.showFile` handler (replacing raw diff from 6c):
    ```ts
    const stashUri = vscode.Uri.parse(`mystash://stash/${stashIndex}/${filePath}`);
    const workspaceUri = vscode.Uri.file(path.join(workspaceRoot, filePath));
    const title = `${path.basename(filePath)} (stash@{${stashIndex}} ↔ Working Copy)`;
    await vscode.commands.executeCommand('vscode.diff', stashUri, workspaceUri, title);
    ```
  - Handle deleted files: if file doesn't exist in working copy, show stash version only
  - Handle new files: if file doesn't exist in stash parent, show stash version as the "after"
  - 📁 `extension.ts`
  - ⚠️ **Depends on:** 6d (`TextDocumentContentProvider` registered)

- [ ] **6f. Show stash summary (stat view)**
  - Add to `mystash.show` command: before opening diff, show a quick notification:
    ```ts
    const stats = await gitService.getStashStats(index);
    // Use stats in the progress message or as a pre-flight info
    ```
  - Or: add a separate `mystash.showStats` command that shows `git stash show --stat` output in an editor
  - 📁 `gitService.ts`, `extension.ts`
  - ⚠️ **Depends on:** 1a-iv (`getStashStats()`)

---

## 7. 🧹 Clear All Stashes

> Remove all stashes at once.

- [x] **7a. Clear with confirmation**
  - Modal warning with stash count → `git stash clear`
  - Respect `mystash.confirmOnClear` setting — if `false`, skip modal
  - 📁 `extension.ts`, `gitService.ts`
  - ⚠️ **Enhance with:** 8e (setting)

---

## 8. ✨ Polish & UX

> Overall UX improvements.

### 8A. Visual Indicators

- [ ] **8a-i. View badge (stash count)**
  - *Alias of 1d-v* — implemented there, listed here for tracking
  - 📁 `extension.ts`

- [ ] **8a-ii. Status bar item**
  - Create in `activate()`:
    ```ts
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBar.command = 'mystashView.focus';
    statusBar.text = '$(archive) 0';
    statusBar.tooltip = 'MyStash — Git Stashes';
    statusBar.show();
    context.subscriptions.push(statusBar);
    ```
  - Update on every refresh: `statusBar.text = \`$(archive) ${count}\``
  - Hide when count is 0 (optional — or show `$(archive) 0` dimmed)
  - 📁 `extension.ts`

- [ ] **8a-iii. Extension icon**
  - Create `images/icon.png` — 128×128px PNG
  - Design: archive/box icon in VS Code blue palette
  - Currently `package.json` references `images/icon.png` which doesn't exist → will cause VSIX packaging error
  - Options: create a simple icon OR use a tool/AI to generate one
  - 📁 `images/icon.png`, verify in `package.json`

### 8B. Settings & Configuration

- [ ] **8e-i. Declare `configuration` contribution in `package.json`**
  - Add under `contributes`:
    ```json
    "configuration": {
      "title": "MyStash",
      "properties": {
        "mystash.autoRefresh": {
          "type": "boolean",
          "default": true,
          "description": "Automatically refresh stash list when git changes are detected or window regains focus."
        },
        "mystash.confirmOnDrop": {
          "type": "boolean",
          "default": true,
          "description": "Show confirmation dialog before dropping a stash."
        },
        "mystash.confirmOnClear": {
          "type": "boolean",
          "default": true,
          "description": "Show confirmation dialog before clearing all stashes."
        },
        "mystash.showFileStatus": {
          "type": "boolean",
          "default": true,
          "description": "Show file status indicators (Modified/Added/Deleted) on stash file items."
        },
        "mystash.defaultIncludeUntracked": {
          "type": "boolean",
          "default": false,
          "description": "Default to including untracked files when creating a stash."
        },
        "mystash.sortOrder": {
          "type": "string",
          "enum": ["newest", "oldest"],
          "default": "newest",
          "description": "Sort order for the stash list."
        },
        "mystash.showBranchInDescription": {
          "type": "boolean",
          "default": true,
          "description": "Show branch name in the stash item description."
        }
      }
    }
    ```
  - 📁 `package.json`

- [ ] **8e-ii. Read settings in code**
  - Helper: `function getConfig<T>(key: string, defaultValue: T): T`
    ```ts
    return vscode.workspace.getConfiguration('mystash').get<T>(key, defaultValue);
    ```
  - Locations that read settings:
    - `extension.ts`: `confirmOnDrop`, `confirmOnClear`, `autoRefresh`, `defaultIncludeUntracked`
    - `stashProvider.ts`: `showFileStatus`, `sortOrder`
    - `stashItem.ts`: `showBranchInDescription`
  - 📁 `extension.ts`, `stashProvider.ts`, `stashItem.ts` or `utils.ts`

- [ ] **8e-iii. Sort order implementation**
  - In `StashProvider.getChildren()` root level, after fetching stashes:
    ```ts
    const order = getConfig('sortOrder', 'newest');
    if (order === 'oldest') { stashes.reverse(); }
    ```
  - Git returns newest-first by default, so `'newest'` requires no change
  - 📁 `stashProvider.ts`
  - ⚠️ **Depends on:** 8e-i

- [ ] **8e-iv. Listen for setting changes**
  - ```ts
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('mystash')) {
        stashProvider.refresh('settings-changed');
      }
    });
    ```
  - 📁 `extension.ts`

### 8C. Keyboard Shortcuts

- [ ] **8d. Default keybindings**
  - Add `keybindings` to `package.json`:
    ```json
    "keybindings": [
      { "command": "mystash.stash", "key": "ctrl+shift+s", "mac": "cmd+shift+s", "when": "workspaceFolderCount > 0" }
    ]
    ```
  - Keep minimal (just create stash) — power users can customize others
  - 📁 `package.json`

### 8D. Multi-Root Workspace (Phase 2 — Design Placeholders)

- [ ] **8c-i. Add `// TODO: multi-root` comments**
  - `gitService.ts` constructor: `// TODO: multi-root — accept workspaceRoot as parameter instead of hardcoding [0]`
  - `stashProvider.ts` `getChildren()`: `// TODO: multi-root — group stashes by workspace folder, add RepoItem parent level`
  - `extension.ts` watchers: `// TODO: multi-root — create watchers for each workspace folder`
  - 📁 `gitService.ts`, `stashProvider.ts`, `extension.ts`

- [ ] **8c-ii. Make `GitService` accept `workspaceRoot` parameter**
  - Change constructor: `constructor(workspaceRoot: string, outputChannel?: vscode.OutputChannel)`
  - Pass from `activate()`: `new GitService(vscode.workspace.workspaceFolders![0].uri.fsPath, outputChannel)`
  - This decouples `GitService` from `vscode.workspace` — cleaner for multi-root later and easier to test
  - 📁 `gitService.ts`, `extension.ts`

---

## 9. 🧪 Testing

> Unit tests (mocked exec, fast) and integration tests (extension host, realistic).

### 9A. Unit Tests — GitService

- [ ] **9a-i. Stash line parsing tests**
  - Mock `execAsync` to return known stdout strings
  - Test cases:
    - Standard: `stash@{0}: On main: my message`
    - WIP: `stash@{0}: WIP on main: abc1234 commit msg`
    - No branch: `stash@{0}: On (no branch): message`
    - No message (WIP-only): `stash@{0}: WIP on main: abc1234`
    - Empty output (no stashes)
    - Malformed line (graceful fallback)
    - Special chars in message: `stash@{0}: On main: fix "quotes" & <brackets>`
  - 📁 `src/test/gitService.test.ts`
  - ✅ **Validates:** 1a-ii

- [ ] **9a-ii. Date parsing tests**
  - Mock `--format` output with known ISO dates
  - Verify `StashEntry.date` is a valid `Date` object
  - Test timezone handling
  - 📁 `src/test/gitService.test.ts`
  - ✅ **Validates:** 1a-iii

- [ ] **9a-iii. Stats parsing tests**
  - Mock `git stash show --stat` output
  - Test: `3 files changed, 12 insertions(+), 5 deletions(-)`
  - Test: `1 file changed, 1 insertion(+)` (no deletions)
  - Test: `1 file changed, 2 deletions(-)` (no insertions)
  - 📁 `src/test/gitService.test.ts`
  - ✅ **Validates:** 1a-iv

- [ ] **9a-iv. File status parsing tests**
  - Mock `git stash show --name-status` output
  - Verify `{ path, status }` tuples
  - Test M, A, D, R status codes
  - 📁 `src/test/gitService.test.ts`
  - ✅ **Validates:** 1a-vi

- [ ] **9a-v. Command construction tests**
  - Verify `createStash()` builds correct git command for each flag combination
  - Verify `applyStash()`, `popStash()`, `dropStash()` pass correct index
  - 📁 `src/test/gitService.test.ts`

- [ ] **9a-vi. Conflict detection tests**
  - Mock `execGit` returning `exitCode: 1` with stderr containing `CONFLICT`
  - Verify `applyStash()` returns `{ success: true, conflicts: true }`
  - Mock real failure (not conflict) → verify throws
  - 📁 `src/test/gitService.test.ts`
  - ✅ **Validates:** 3c, 4c

### 9B. Unit Tests — Models & Utils

- [ ] **9b-i. `formatRelativeTime()` tests**
  - Test boundary cases: 0s, 59s, 60s, 59m, 60m, 23h, 24h, 6d, 7d, 364d, 365d
  - Verify output strings match expected format
  - 📁 `src/test/utils.test.ts`
  - ✅ **Validates:** 1b-iii

- [ ] **9b-ii. `StashItem` property tests**
  - Construct with known `StashEntry`, verify: label, description, tooltip content, icon, contextValue, collapsibleState
  - 📁 `src/test/stashItem.test.ts`

- [ ] **9b-iii. `StashFileItem` property tests**
  - Construct with known path + status, verify: label (filename only), description (dirname), icon (status-based), command
  - 📁 `src/test/stashItem.test.ts`

### 9C. Integration Tests — Extension Host

- [ ] **9c-i. Extension activation test**
  - Verify extension activates successfully
  - Verify all commands are registered (`vscode.commands.getCommands()`)
  - 📁 `src/test/extension.test.ts`

- [ ] **9c-ii. Tree view population test**
  - In a test git repo with stashes, verify tree view populates
  - Verify child items appear on expand
  - 📁 `src/test/extension.test.ts`

- [ ] **9c-iii. Command execution smoke tests**
  - Execute `mystash.refresh` → no throw
  - Execute `mystash.show` → verify it opens an editor
  - 📁 `src/test/extension.test.ts`

---

## 10. 📦 Packaging & Release Prep

- [ ] **10a. Verify `.vscodeignore`**
  - Ensure `src/`, `out/`, `.vscode-test/`, test files are excluded from VSIX
  - Current `.vscodeignore` looks correct — verify after adding new files
  - 📁 `.vscodeignore`

- [ ] **10b. `CHANGELOG.md` initial entry**
  - Add `0.0.1` entry with all implemented features
  - 📁 `CHANGELOG.md`

- [ ] **10c. Extension icon (`images/icon.png`)**
  - *Alias of 8a-iii* — tracked here for release checklist
  - 📁 `images/icon.png`

---

## Dependency Graph (Critical Path)

```
0a (execGit refactor) ──┬──→ 3c (conflict detection - apply)
                        ├──→ 4c (conflict detection - pop)
                        ├──→ 1a-vi (getStashFilesWithStatus)
                        ├──→ 1a-vii (getStashFileContent)
                        └──→ 1a-viii (getStashFileDiff)

0b (output channel) ────→ 1e-ii (auto-refresh logging)

0c (pickStash helper) ──→ refactor apply/pop/drop/show commands

1a-ii (parsing) ────────→ 1a-iii (date parsing uses same regex)
1a-vi (file status) ────→ 1b-vi (status icons) ──→ 1c-vii (provider uses status)
1a-vii (file content) ──→ 6d (TextDocumentContentProvider)
1a-viii (file diff) ────→ 6c (showFile command)

1c-iv (context keys) ──→ 1d-iv (welcome view)
1d-iv (welcome view) ──→ 1c-v (remove toasts, welcome replaces them)

8e-i (settings) ────────┬──→ 1b-ii (showBranchInDescription)
                        ├──→ 1c-vii (showFileStatus)
                        ├──→ 1e-ii (autoRefresh)
                        ├──→ 1e-iii (autoRefresh)
                        ├──→ 2d (defaultIncludeUntracked)
                        └──→ 8e-iii (sortOrder)

6d (content provider) ──→ 6e (side-by-side diff)
6c (showFile command) ──→ 1b-v (click-to-diff wiring)
```

## Suggested Implementation Order

1. **Phase 0 — Foundation:** 0a → 0b → 0c → 8e-i
2. **Phase 1 — Core List:** 1a-ii → 1a-iii → 1b-iii → 1b-ii → 1c-iv → 1d-iv → 1c-v → 1c-vi
3. **Phase 2 — File Items:** 1a-vi → 1b-vi → 1c-vii → 1b-v → 1a-x
4. **Phase 3 — Diff Viewing:** 1a-vii → 1a-viii → 6d → 6c → 6e
5. **Phase 4 — Commands Hardening:** 2c → 2d → 2e → 2f → 3c → 3d → 4c → 4d
6. **Phase 5 — Reactivity:** 1e-ii → 1e-iii → 8e-ii → 8e-iii → 8e-iv
7. **Phase 6 — Polish:** 1d-v → 1d-vi → 8a-ii → 8a-iii → 8d → 8c-i → 8c-ii
8. **Phase 7 — Testing:** 9a → 9b → 9c
9. **Phase 8 — Release:** 10a → 10b → 10c

---

## Progress Summary

| Section                    | Sub-tasks | Done | Remaining |
|----------------------------|-----------|------|-----------|
| 0. Refactors & Infra       | 8         | 8    | 0         |
| 1. Display Stash List       | 28        | 10   | 18        |
| 2. Create Stash             | 6         | 2    | 4         |
| 3. Apply Stash              | 4         | 2    | 2         |
| 4. Pop Stash                | 4         | 2    | 2         |
| 5. Drop Stash               | 2         | 2    | 0         |
| 6. Show Stash Contents      | 6         | 2    | 4         |
| 7. Clear All Stashes        | 1         | 1    | 0         |
| 8. Polish & UX              | 12        | 0    | 12        |
| 9. Testing                  | 9         | 0    | 9         |
| 10. Packaging & Release     | 3         | 0    | 3         |
| **Total**                   | **83**    | **29** | **54**  |
