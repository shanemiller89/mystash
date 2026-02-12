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
> - Webview panel uses React 18 + Zustand + Tailwind CSS 4 + date-fns (separate build pipeline)

---

## Current File Inventory

```
MyStash/
├── src/
│   ├── extension.ts            # activate/deactivate, command registration, wiring
│   ├── gitService.ts           # GitService class — all git CLI operations
│   ├── stashProvider.ts        # TreeDataProvider for the stash list view
│   ├── stashItem.ts            # StashItem & StashFileItem tree item models
│   ├── stashContentProvider.ts # TextDocumentContentProvider (mystash: URI scheme)
│   ├── stashPanel.ts           # WebviewPanel — loads React app, handles messages
│   ├── uiUtils.ts              # pickStash() QuickPick helper
│   ├── utils.ts                # formatRelativeTime(), getConfig()
│   └── test/
│       └── extension.test.ts   # Integration tests (extension host) — scaffold only
├── webview-ui/
│   ├── tsconfig.json           # Separate tsconfig (jsx: react-jsx, DOM lib)
│   └── src/
│       ├── main.tsx            # React entry point
│       ├── App.tsx             # Root component, message listener → Zustand store
│       ├── store.ts            # Zustand store (stashes, search, expand state)
│       ├── vscode.ts           # Type-safe webview messaging wrapper
│       ├── index.css           # Tailwind v4 + VS Code theme variable mapping
│       └── components/
│           ├── StashList.tsx    # Search bar, card list, empty states, footer
│           ├── StashCard.tsx    # Stash card with actions, stats, expand/collapse
│           └── StashFiles.tsx   # File list with status icons, click-to-diff
├── dist/
│   ├── extension.js            # Extension bundle (Node CJS, esbuild)
│   ├── webview.js              # Webview bundle (Browser ESM, esbuild)
│   └── webview.css             # Tailwind CSS output (@tailwindcss/cli)
├── package.json                # Extension manifest
├── tsconfig.json               # Extension tsconfig (excludes webview-ui/)
├── esbuild.js                  # Dual build config (extension + webview)
└── PUNCHLIST.md                # This file
```

---

## 0. 🏗️ Refactors & Infrastructure ✅ COMPLETE

> All foundational changes are done.

- [x] **0a.** `GitResult` interface + `execGit()` structured return (never throws)
- [x] **0b.** Output channel (`MyStash`) — git commands logged, refresh reasons logged
- [x] **0c.** `pickStash()` helper in `uiUtils.ts` — replaces 4 duplicated QuickPick blocks

---

## 1. 🗂️ Display Stash List ✅ COMPLETE

> Sidebar tree view with rich details, file items, context keys, welcome views, watchers.

- [x] **1a.** Git layer — `getStashList()` with `--format`, date parsing, WIP detection, `getStashStats()`, `getStashFilesWithStatus()`, `getStashFileContent()`, `getStashFileDiff()`, `hasChanges()`, `isGitRepository()`
- [x] **1b.** Tree items — `StashItem` (MarkdownString tooltip, conditional branch, relative time), `StashFileItem` (status icons M/A/D/R/C, click→showFile)
- [x] **1c.** `StashProvider` — context keys, debounced refresh, `resolveTreeItem` for lazy stats, badge, dynamic title, no toasts
- [x] **1d.** View registration — activity bar, welcome views (3 states), commands, menus (inline + context)
- [x] **1e.** Reactivity — git file watcher, window focus refresh, `// TODO: multi-root` comments

---

## 2. ➕ Create Stash — Hardening

> Basic create works. Needs UX polish.

- [x] **2a.** Stash with message prompt (InputBox → `git stash push -m`)
- [x] **2b.** Include untracked files option (QuickPick Yes/No)

- [x] **2c. Handle no-changes edge case**
  - Before showing InputBox, call `gitService.hasChanges()`
  - If `false`: `showInformationMessage('No local changes to stash')` and return
  - 📁 `extension.ts`

- [x] **2d. Three-way stash mode QuickPick**
  - Replace the Yes/No untracked prompt with a 3-option QuickPick:
    - `All Changes` — no extra flags
    - `Staged Only` — `--staged` (git 2.35+)
    - `Include Untracked` — `--include-untracked`
  - Pre-select based on `mystash.defaultIncludeUntracked` setting
  - `createStash()` now accepts `mode: StashMode` (`'all' | 'staged' | 'untracked'`)
  - 📁 `extension.ts`, `gitService.ts`

- [x] **2e. Cancel-safe flow**
  - **Bug:** pressing Escape on the message InputBox continues to the untracked QuickPick
  - Fix: check `message === undefined` (Escape) vs `message === ''` (empty submit)
  - Empty submit re-prompts with "Create stash without a message?" confirmation
  - Guard each step: `if (!mode) { return; }`
  - 📁 `extension.ts`

- [x] **2f. Progress indicator for create**
  - Wrap `createStash()` in `vscode.window.withProgress()` with notification
  - 📁 `extension.ts`

---

## 3. ✅ Apply Stash — Hardening

> Basic apply works. Needs conflict detection + progress.

- [x] **3a.** Apply from tree view (inline button)
- [x] **3b.** Apply from command palette (via `pickStash()`)

- [x] **3c. Handle merge conflicts on apply**
  - Inspect `exitCode` + `stderr.includes('CONFLICT')` → partial success
  - Return `StashOperationResult { success, conflicts, message }` from `applyStash()`
  - Show warning message on conflict instead of error
  - Also updated `stashPanel.ts` webview handler
  - 📁 `gitService.ts`, `extension.ts`, `stashPanel.ts`

- [x] **3d. Progress indicator**
  - Wrap apply in `vscode.window.withProgress()` (Notification, cancellable: false)
  - 📁 `extension.ts`

---

## 4. ⬆️ Pop Stash — Hardening

> Basic pop works. Needs conflict detection + progress.

- [x] **4a.** Pop from tree view (inline button)
- [x] **4b.** Pop from command palette (via `pickStash()`)

- [x] **4c. Handle conflicts on pop**
  - Same as 3c but: if pop encounters conflicts, stash is **NOT dropped** (remains in list)
  - Show: `'Stash applied with conflicts but was NOT removed. Resolve conflicts, then drop manually.'`
  - Also updated `stashPanel.ts` webview handler
  - 📁 `gitService.ts`, `extension.ts`, `stashPanel.ts`

- [x] **4d. Progress indicator**
  - Same as 3d but for pop (Notification, cancellable: false)
  - 📁 `extension.ts`

---

## 5. 🗑️ Drop Stash ✅ COMPLETE

- [x] **5a.** Drop with confirmation modal
- [x] **5b.** Drop from command palette (via `pickStash()`)

---

## 6. 👁️ Show Stash Contents

> Full diff, per-file diff, and side-by-side diff viewer all work. Some polish left.

- [x] **6a.** Show full stash diff (`git stash show -p` → diff editor tab)
- [x] **6b.** Show from command palette (via `pickStash()`)
- [x] **6c.** `mystash.showFile` command — per-file diff (hidden from palette)
- [x] **6d.** `StashContentProvider` — `mystash:` URI scheme, `?ref=parent|stash&index=N`
- [x] **6e.** Side-by-side diff view using `vscode.diff` (parent ↔ stash version)

- [x] **6f. Show stash summary (stat view)**
  - `mystash.showStats` command shows `git stash show --stat` in a plaintext editor with header
  - Registered in package.json commands, context menu, and command palette
  - 📁 `extension.ts`, `package.json`

---

## 7. 🧹 Clear All Stashes ✅ COMPLETE

- [x] **7a.** Clear with confirmation modal (shows stash count)

---

## 8. 🎨 Webview Panel (React)

> Rich interactive stash explorer in an editor tab. Core is built, needs polish.

### 8A. Core (Done)

- [x] **8a-i. React + Zustand + Tailwind build pipeline**
  - `webview-ui/` directory with separate `tsconfig.json`
  - esbuild dual-context build (extension CJS + webview ESM)
  - Tailwind CSS v4 built via `@tailwindcss/cli`
  - 📁 `esbuild.js`, `webview-ui/tsconfig.json`, `package.json` scripts

- [x] **8a-ii. VS Code theme integration**
  - Tailwind `@theme` block maps `--vscode-*` CSS variables to custom color tokens
  - Cards, badges, buttons, inputs all use VS Code theme colors
  - 📁 `webview-ui/src/index.css`

- [x] **8a-iii. Zustand store + messaging**
  - Store: stashes, expandedIndices, loading, searchQuery, filteredStashes()
  - Type-safe `postMessage()` / `onMessage()` wrapper
  - Extension sends data via `postMessage` (no HTML replacement → no flashing)
  - 📁 `webview-ui/src/store.ts`, `webview-ui/src/vscode.ts`

- [x] **8a-iv. StashPanel host class**
  - Singleton pattern, `retainContextWhenHidden: true`
  - Loads `dist/webview.js` + `dist/webview.css` via `asWebviewUri()`
  - CSP with nonce for scripts, webview cspSource for styles
  - Handles all stash operations (apply/pop/drop/showFile/create/clear)
  - 📁 `src/stashPanel.ts`

- [x] **8a-v. React components**
  - `StashList` — search bar, card list, empty states, footer with count + Clear All
  - `StashCard` — color indicator (WIP yellow / normal blue), message, branch badge, relative date, stats, hover action buttons, expand/collapse
  - `StashFiles` — file list with status icons (M/A/D/R/C), click-to-diff
  - 📁 `webview-ui/src/components/`

### 8B. Webview Polish (Todo)

- [x] **8b-i. Card height / layout bug**
  - Added explicit `leading-normal`, `leading-[18px]`, `leading-[16px]`, `self-stretch` on color indicator
  - Verified min-h-[52px] and line-height stability across themes
  - 📁 `webview-ui/src/components/StashCard.tsx`

- [x] **8b-ii. Stash creation from webview**
  - Full inline form: message input + 3-way mode selector (All / Staged / Untracked)
  - `+` button in header bar toggles form, Enter submits, Escape cancels
  - New `createStashInline` message type handled in StashPanel
  - `showCreateForm` state added to Zustand store
  - 📁 `webview-ui/src/components/StashList.tsx`, `webview-ui/src/store.ts`, `src/stashPanel.ts`

- [x] **8b-iii. Webview auto-refresh**
  - When tree view refreshes (git watcher, focus, settings), also refresh the webview panel if open
  - Added `StashPanel.refreshIfOpen()` static method, called from `StashProvider.refresh()`
  - 📁 `src/stashPanel.ts`, `src/stashProvider.ts`

- [x] **8b-iv. Loading skeleton / spinner**
  - Animated skeleton cards (pulse animation) shown while loading
  - 3 skeleton cards displayed in place of "Loading stashes…" text
  - 📁 `webview-ui/src/components/StashList.tsx`

- [x] **8b-v. Keyboard navigation**
  - Full roving tabindex: Arrow Up/Down between cards, Home/End, Escape clears search
  - Enter/Space to expand card, `a`/`p`/`d` keyboard shortcuts for apply/pop/drop
  - Focus ring via `ring-1 ring-accent` on focused card, ARIA attributes
  - Arrow Down from search enters list, Arrow Up from first card returns to search
  - 📁 `webview-ui/src/components/StashList.tsx`, `webview-ui/src/components/StashCard.tsx`

- [x] **8b-vi. Webview panel icon & title**
  - Show stash count in panel title: `MyStash (3)`
  - Updated on each refresh
  - 📁 `src/stashPanel.ts`

---

## 9. ✨ Polish & UX

> Settings integration, status bar, keybindings, visual improvements.

### 9A. Settings Integration

- [x] **9a-i. Declare settings in `package.json`**
  - 7 settings: autoRefresh, confirmOnDrop, confirmOnClear, showFileStatus, defaultIncludeUntracked, sortOrder, showBranchInDescription

- [x] **9a-ii. `getConfig()` helper usage audit**
  - `confirmOnDrop` → wired in drop command (conditional modal)
  - `confirmOnClear` → wired in clear command (conditional modal)
  - `showFileStatus` → already used in `stashProvider.ts` and `stashItem.ts`
  - `sortOrder` → wired in 9a-iii
  - `showBranchInDescription` → already used in `stashItem.ts`
  - `autoRefresh` → already used in window focus handler
  - `defaultIncludeUntracked` → wired in 2d create stash flow
  - 📁 `extension.ts`

- [x] **9a-iii. Sort order implementation**
  - In `StashProvider.getChildren()` root level: if `sortOrder === 'oldest'`, reverse
  - 📁 `stashProvider.ts`

- [x] **9a-iv. Listen for setting changes**
  - `vscode.workspace.onDidChangeConfiguration` → refresh on `mystash.*` change
  - 📁 `extension.ts`

### 9B. Visual Indicators

- [x] **9b-i. Status bar item**
  - `$(archive) N` in the status bar, click → `mystashView.focus`
  - Updated in StashProvider.getChildren() on every refresh, hidden when count is 0
  - `setStatusBarItem()` method added to StashProvider
  - 📁 `extension.ts`, `stashProvider.ts`

- [x] **9b-ii. Extension icon**
  - Created placeholder SVG (`images/icon.svg`) + converted to PNG (`images/icon.png`)
  - Stacked boxes gradient design representing stashes
  - 📁 `images/icon.svg`, `images/icon.png`

### 9C. Keyboard Shortcuts

- [x] **9c-i. Default keybinding**
  - `Cmd+Shift+S` (Mac) / `Ctrl+Shift+S` (Win/Linux) → `mystash.stash`
  - `when: workspaceFolderCount > 0`
  - 📁 `package.json`

### 9D. Multi-Root Workspace (Phase 2 — Placeholders)

- [x] **9d-i. `// TODO: multi-root` comments** — added in gitService, stashProvider, extension

- [x] **9d-ii. Decouple `GitService` from workspace**
  - Constructor: `(workspaceRoot?, outputChannel?, execFn?)` — explicit workspace root
  - `ExecFn` type exported for injectable test mocking
  - Extension passes `workspaceFolders[0]?.uri.fsPath` explicitly
  - 📁 `gitService.ts`, `extension.ts`

---

## 10. 🧪 Testing

> Unit tests (mocked exec, fast) and integration tests (extension host, realistic).

### 10A. Unit Tests — GitService

- [x] **10a-i. Stash line parsing tests**
  - Standard, WIP, no-branch, no-message, empty, pipes in message, branch with slashes
  - 📁 `src/test/gitService.test.ts`

- [x] **10a-ii. Date parsing tests**
  - Mock `--format` output, verify Date objects, invalid date fallback
  - 📁 `src/test/gitService.test.ts`

- [x] **10a-iii. Stats parsing tests**
  - Standard stat, insertions-only, deletions-only, non-zero exit
  - 📁 `src/test/gitService.test.ts`

- [x] **10a-iv. File status parsing tests**
  - Mixed M/A/D status, renamed file, error handling
  - 📁 `src/test/gitService.test.ts`

- [x] **10a-v. Command construction tests**
  - All mode flags (all, staged, untracked), message quoting, no-message
  - 📁 `src/test/gitService.test.ts`

- [x] **10a-vi. Conflict detection tests**
  - applyStash: clean, CONFLICT, non-conflict error
  - popStash: CONFLICT (not dropped), non-conflict error
  - 📁 `src/test/gitService.test.ts`

### 10B. Unit Tests — Models & Utils

- [x] **10b-i. `formatRelativeTime()` tests**
  - All boundaries: 0s, 59s, 60s, 59m, 60m, 1h, 2h, 23h, 24h, 2d, 6d, 7d, 364d, 365d, future date
  - 📁 `src/test/utils.test.ts`

- [x] **10b-ii. `StashItem` property tests**
  - label, description, tooltip (MarkdownString), icon (archive), contextValue, collapsibleState, updateTooltipWithStats
  - 📁 `src/test/stashItem.test.ts`

- [x] **10b-iii. `StashFileItem` property tests**
  - label (filename), description (directory), icon per status (M/A/D/none), command, contextValue, tooltip
  - 📁 `src/test/stashItem.test.ts`

### 10C. Integration Tests — Extension Host

- [x] **10c-i. Extension activation test**
  - Verify extension found by ID, activates, isActive
  - 📁 `src/test/extension.test.ts`

- [x] **10c-ii. Tree view population test**
  - Verifies all 10 expected commands are registered (including showStats)
  - 📁 `src/test/extension.test.ts`

- [x] **10c-iii. Command execution smoke tests**
  - `mystash.refresh` doesNotReject smoke test
  - 📁 `src/test/extension.test.ts`

---

## 11. 📦 Packaging & Release Prep

- [x] **11a. Verify `.vscodeignore`**
  - Excludes: src/, webview-ui/, out/, .vscode-test/, .github/, PUNCHLIST.md, test files
  - Includes: dist/ (extension.js, webview.js, webview.css), images/
  - 📁 `.vscodeignore`

- [x] **11b. `CHANGELOG.md` initial entry**
  - Full 0.1.0 entry with all features documented
  - 📁 `CHANGELOG.md`

- [x] **11c. Extension icon**
  - Alias of 9b-ii — SVG + PNG created
  - 📁 `images/icon.png`, `images/icon.svg`

- [x] **11d. README.md update**
  - Full rewrite: feature overview, operations table, settings table, commands table, dev guide, project structure
  - 📁 `README.md`

- [x] **11e. Minify production build**
  - `npm run package` passes clean (check-types + lint + CSS + esbuild --production)
  - dist/: extension.js 22K, webview.js 200K, webview.css 15K
  - Moved react/react-dom/zustand/date-fns from dependencies → devDependencies
  - 📁 `package.json`

---

## Dependency Graph

```
3c (conflict: apply) ──→ 10a-vi (conflict tests)
4c (conflict: pop)   ──→ 10a-vi (conflict tests)

9a-ii (settings audit) ─→ 9a-iii (sort order)
                         → 9a-iv (setting change listener)

8b-iii (webview refresh) → needs stashPanel.refreshIfOpen() static method

11a-11e (packaging) → all features should be stable first
```

## Suggested Implementation Order

1. **Command Hardening:** 2c → 2d → 2e → 2f → 3c → 3d → 4c → 4d
2. **Settings Wiring:** 9a-ii → 9a-iii → 9a-iv
3. **Webview Polish:** 8b-i → 8b-iii → 8b-iv → 8b-vi
4. **Visual Polish:** 9b-i → 9c-i → 6f
5. **Testing:** 10a → 10b → 10c
6. **Release Prep:** 11a → 11b → 9b-ii/11c → 11d → 11e

---

## Progress Summary

| Section                          | Sub-tasks | Done | Remaining |
|----------------------------------|-----------|------|-----------|
| 0. Refactors & Infrastructure    | 3         | 3    | 0         |
| 1. Display Stash List            | 5         | 5    | 0         |
| 2. Create Stash — Hardening     | 6         | 6    | 0         |
| 3. Apply Stash — Hardening      | 4         | 4    | 0         |
| 4. Pop Stash — Hardening        | 4         | 4    | 0         |
| 5. Drop Stash                    | 2         | 2    | 0         |
| 6. Show Stash Contents           | 6         | 6    | 0         |
| 7. Clear All Stashes             | 1         | 1    | 0         |
| 8. Webview Panel (React)         | 11        | 11   | 0         |
| 9. Polish & UX                   | 8         | 8    | 0         |
| 10. Testing                      | 9         | 9    | 0         |
| 11. Packaging & Release          | 5         | 5    | 0         |
| **Total**                        | **64**    | **64** | **0**   |
