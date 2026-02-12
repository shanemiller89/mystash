# Change Log

All notable changes to the "mystash" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.1.0] — 2026-02-11

### Added

- **Sidebar tree view** — browse all git stashes in a dedicated Activity Bar container with badge count, dynamic title, and welcome views for no-workspace, no-git, and no-stashes states.
- **Rich stash items** — each stash shows message, branch, relative date, and lazy-loaded stats (files changed, insertions, deletions) in a MarkdownString tooltip.
- **File items with status** — expand a stash to see its files with M/A/D/R/C status icons; click any file to open a side-by-side diff.
- **Create stash** — three stash modes via QuickPick: All Changes, Staged Only, Include Untracked. Cancel-safe flow with progress indicator.
- **Apply / Pop** — apply or pop stashes with merge-conflict detection. Conflicts show a warning; pop leaves the stash in the list on conflict.
- **Drop / Clear** — drop a single stash or clear all, with configurable confirmation dialogs.
- **Show stash diff** — open the full `git stash show -p` output in a diff editor tab.
- **Show stash stats** — `mystash.showStats` command shows `git stash show --stat` in a plaintext editor.
- **Per-file diff viewer** — `TextDocumentContentProvider` with `mystash:` URI scheme (no temp files).
- **Webview panel** — rich React + Zustand + Tailwind CSS 4 panel in an editor tab:
  - Search/filter stashes by message, branch, or filename.
  - Stash cards with WIP indicator, branch badge, relative date, stats, hover actions.
  - Inline stash creation form with message input and mode selector.
  - Loading skeletons during refresh.
  - Full roving-tabindex keyboard navigation (Arrow Up/Down, Enter, Escape, Home/End).
  - Empty state with "Create Stash" button.
- **Auto-refresh** — git file watcher + window focus trigger, configurable via `mystash.autoRefresh`.
- **Status bar item** — shows `$(archive) N` stash count, click to focus tree view, hidden when 0.
- **Default keybinding** — `Cmd+Shift+S` (Mac) / `Ctrl+Shift+S` (Win/Linux) to create a stash.
- **7 user settings** — `autoRefresh`, `confirmOnDrop`, `confirmOnClear`, `showFileStatus`, `defaultIncludeUntracked`, `sortOrder`, `showBranchInDescription`.
- **Settings change listener** — tree view and webview auto-refresh when `mystash.*` settings change.
- **`pickStash()` helper** — single extracted QuickPick function used by all palette commands.
- **Structured `GitResult`** — `execGit()` returns `{ stdout, stderr, exitCode }`, never throws.
- **Injectable `ExecFn`** — `GitService` constructor accepts a custom exec function for unit testing.
- **Unit tests** — GitService (stash parsing, stats, file status, commands, conflict detection), `formatRelativeTime()`, `StashItem` / `StashFileItem` properties.
- **Integration tests** — extension activation, command registration, refresh smoke test.
- **Extension icon** — placeholder SVG/PNG in `images/`.