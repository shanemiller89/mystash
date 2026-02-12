<!-- Workspace-specific instructions for GitHub Copilot. -->
<!-- Docs: https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# MyStash — VS Code Extension for Git Stash Management

## Project Overview

MyStash is a VS Code extension that gives users a rich sidebar UI for managing git stashes — creating, viewing, applying, popping, dropping, and inspecting stash contents with side-by-side diffs.

- **Repository**: `shanemiller89/mystash` on GitHub
- **Branch strategy**: `main` (single branch for now)
- **Punch list**: See `PUNCHLIST.md` for the full task tracker with dependency graph and implementation order.

## Technology Stack

| Layer         | Choice                        |
|---------------|-------------------------------|
| Language      | TypeScript (strict mode)      |
| Runtime       | VS Code Extension Host        |
| API           | VS Code Extension API ^1.109  |
| Bundler       | esbuild (not webpack)         |
| Test Runner   | Mocha + @vscode/test-cli      |
| Package Mgr   | npm                           |
| Linter        | ESLint (flat config)          |

- **No runtime dependencies** — only `devDependencies`.
- Build output goes to `dist/extension.js` (esbuild bundle).
- Type-checking uses `tsc --noEmit` (esbuild handles emit).

## Architecture Decisions (Locked)

These are final. Do not deviate without explicit user approval.

1. **`execGit()` returns structured `GitResult`** — `{ stdout, stderr, exitCode }`. Callers decide what exit codes mean. Do NOT throw on non-zero exit.
2. **Diff viewing uses `TextDocumentContentProvider`** with `mystash:` URI scheme. No temp files.
3. **Multi-root workspace is Phase 2** — design for it (accept `workspaceRoot` as a parameter, add `// TODO: multi-root` comments) but don't implement it yet.
4. **`pickStash()` helper** — a single extracted function replaces the duplicated QuickPick fallback in apply/pop/drop/show commands.
5. **Both unit tests AND integration tests** — unit tests mock `execAsync` (fast, no VS Code host). Integration tests run in the extension host.

## Project Structure

```
MyStash/
├── src/
│   ├── extension.ts            # activate/deactivate, command registration, wiring
│   ├── gitService.ts           # GitService class — all git CLI operations
│   ├── stashProvider.ts        # TreeDataProvider for the stash list view
│   ├── stashItem.ts            # StashItem & StashFileItem tree item models
│   ├── stashContentProvider.ts # TextDocumentContentProvider (mystash: URI scheme) [planned]
│   ├── utils.ts                # Pure helpers: formatRelativeTime, getConfig [planned]
│   └── test/
│       ├── extension.test.ts   # Integration tests (extension host)
│       ├── gitService.test.ts  # Unit tests for git parsing/commands [planned]
│       ├── stashItem.test.ts   # Unit tests for tree item models [planned]
│       └── utils.test.ts       # Unit tests for utility functions [planned]
├── package.json                # Extension manifest (commands, views, menus, settings)
├── PUNCHLIST.md                # Development task tracker
├── tsconfig.json               # TypeScript config (noEmit, strict)
├── esbuild.js                  # Bundle config
├── eslint.config.mjs           # ESLint flat config
└── .vscode/                    # Dev environment config
```

## Key Interfaces & Patterns

### `GitResult` (planned — task 0a)
```ts
interface GitResult { stdout: string; stderr: string; exitCode: number }
```

### `StashEntry`
```ts
interface StashEntry {
  index: number;    // stash@{index}
  name: string;     // "stash@{0}"
  branch: string;   // branch name
  message: string;  // user message or "(no message)"
  date: Date;       // [planned] parsed from git --format
  stats?: {         // [planned] lazy-loaded from git stash show --stat
    filesChanged: number;
    insertions: number;
    deletions: number;
  };
}
```

### Command Registration Pattern
```ts
context.subscriptions.push(
  vscode.commands.registerCommand('mystash.commandName', async (item?: StashItem) => {
    if (!item) { item = await pickStash(gitService, 'Select a stash'); }
    if (!item) { return; }
    // ... operation
    stashProvider.refresh('post-command');
  })
);
```

### Error Handling Pattern
- **User-facing errors**: `vscode.window.showErrorMessage()` with clear context
- **Diagnostics**: Log to `OutputChannel('MyStash')` — git commands, exit codes, stderr
- **Tree view errors**: Return empty array + let welcome view handle messaging. NEVER call `showInformationMessage()` inside `getChildren()`.
- **Conflict detection**: Check `exitCode !== 0` AND `stderr.includes('CONFLICT')` — this is a partial success, not a hard error.

## Coding Conventions

### TypeScript
- Use `async/await` everywhere — no raw `.then()` chains.
- Strict mode is on — no `any` unless absolutely necessary (prefer `unknown`).
- Use `const` by default, `let` only when reassignment is needed.
- Destructure where it improves readability: `const { stdout, exitCode } = await this.execGit(...)`.
- Name private fields with `_` prefix for internal state: `_refreshTimer`, `_isRefreshing`.
- Export interfaces from the file that owns them (`StashEntry` from `gitService.ts`).

### VS Code Extension API
- Push all disposables to `context.subscriptions`.
- Use `vscode.ThemeIcon` for icons — not file paths.
- Use `vscode.MarkdownString` for rich tooltips.
- Use `vscode.workspace.getConfiguration('mystash')` to read settings.
- Use `vscode.commands.executeCommand('setContext', key, value)` for `when` clause keys.
- Use `vscode.window.withProgress()` for operations that may take > 500ms.

### Git CLI
- All git operations go through `GitService.execGit(command)`.
- Never call `child_process` directly outside of `gitService.ts`.
- Quote user-provided strings in commands: `-m "${message}"`.
- Use `--format` for structured git output when available.

### Naming
- Files: `camelCase.ts`
- Classes: `PascalCase` — `GitService`, `StashProvider`, `StashItem`
- Interfaces: `PascalCase` — `StashEntry`, `GitResult`
- Commands: `mystash.verbNoun` — `mystash.showFile`, `mystash.refresh`
- Settings: `mystash.camelCase` — `mystash.autoRefresh`, `mystash.confirmOnDrop`
- Context keys: `mystash.camelCase` — `mystash.hasStashes`, `mystash.isGitRepo`

## Commands

| Command              | Description                    | Palette | Tree View |
|----------------------|--------------------------------|---------|-----------|
| `mystash.refresh`    | Refresh the stash list         | ✅      | Title bar |
| `mystash.stash`      | Create a new stash             | ✅      | Title bar |
| `mystash.apply`      | Apply a stash (keep in list)   | ✅      | Inline    |
| `mystash.pop`        | Pop a stash (apply + remove)   | ✅      | Context   |
| `mystash.drop`       | Drop a stash permanently       | ✅      | Context   |
| `mystash.show`       | Show full stash diff           | ✅      | Inline    |
| `mystash.clear`      | Clear all stashes              | ✅      | Title bar |
| `mystash.showFile`   | Show per-file diff [planned]   | Hidden  | File click|

## Settings (Planned — task 8e)

| Setting                             | Type    | Default   | Description                          |
|-------------------------------------|---------|-----------|--------------------------------------|
| `mystash.autoRefresh`               | bool    | `true`    | Auto-refresh on git changes / focus  |
| `mystash.confirmOnDrop`             | bool    | `true`    | Confirm before dropping a stash      |
| `mystash.confirmOnClear`            | bool    | `true`    | Confirm before clearing all stashes  |
| `mystash.showFileStatus`            | bool    | `true`    | Show M/A/D indicators on file items  |
| `mystash.defaultIncludeUntracked`   | bool    | `false`   | Default include untracked on create  |
| `mystash.sortOrder`                 | enum    | `newest`  | Stash list sort: `newest` / `oldest` |
| `mystash.showBranchInDescription`   | bool    | `true`    | Show branch name in tree item desc   |

## When Implementing a PUNCHLIST Item

1. **Read the task** in `PUNCHLIST.md` — note the task ID, dependencies, and file targets.
2. **Check dependencies** — if the task says `⚠️ Depends on: X`, verify X is done first.
3. **Implement** in the listed file(s), following the patterns above.
4. **Mark done** — change `- [ ]` to `- [x]` in `PUNCHLIST.md`.
5. **Update the progress table** at the bottom of `PUNCHLIST.md`.
6. **Run `npm run compile`** to verify no errors before committing.
