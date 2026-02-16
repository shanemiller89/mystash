# Change Log

All notable changes to the "superprompt-forge" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.3.0] — 2026-02-16

### Added

- **GitHub PRs tab** — browse open/closed/merged PRs, detail view with comments, reviewers, labels, assignees, timeline, and review-requested filter.
- **GitHub Issues tab** — list/detail view with state badges, comments, labels, milestones, and assignee filters.
- **GitHub Projects tab** — board and table views for GitHub Projects v2, with item detail, column grouping, and status filters.
- **GitHub Wiki tab** — browse and view repo wiki pages with Markdown rendering.
- **Mattermost tab** — channel/DM list with team selector, chat view with compose, thread replies, emoji reactions, file attachments, and WebSocket real-time updates.
- **Google Drive tab** — browse, preview, and search Drive files with folder navigation.
- **Google Calendar tab** — upcoming events view with date range, all-day events, and calendar filtering.
- **AI Agent tab** — Gemini-powered contextual AI assistant with chat history, streaming responses, tab-scoped context gathering, and cancellation support.
- **Floating AI Chat** — persistent floating chat panel with drag-to-move and drag-to-resize, available across all tabs.
- **Tab Summary pane** — AI-generated summary sidebar for each tab, with resizable split panel and per-tab persistence.
- **Repo Switcher** — switch active GitHub repo from the webview, with user repo search and auto-detect fallback.
- **Settings tab** — in-webview settings panel with keyboard shortcut reference.
- **Emoji picker** — full emoji picker and autocomplete for Mattermost compose.
- **Link previews** — inline link preview cards in Mattermost messages.
- **Mermaid diagrams** — rendered Mermaid blocks in Markdown content.

### Changed

- **Architecture: Handler decomposition** — extracted all webview message handling from `StashPanel` into domain-specific handler modules (`stashHandlers`, `prHandlers`, `issueHandlers`, `notesHandlers`, `mattermostHandlers`, `projectHandlers`, `driveHandlers`, `calendarHandlers`, `wikiHandlers`, `agentHandlers`) with a shared `HandlerContext` interface.
- **Architecture: `App.tsx` decomposition** — split monolithic App component into per-tab components (`PRsTab`, `IssuesTab`, `NotesTab`, `MattermostTab`, `DriveTab`, `CalendarTab`, `ProjectsTab`, `AgentTab`), each with its own `TabWithSummary` wrapper.
- **Tab bar: Grouped tabs with overflow** — tabs organized into 5 groups (Chat, Notes, GitHub, Google, Agent) with dropdown menus for multi-tab groups and ResizeObserver-based overflow into a "More…" menu at narrow widths.
- **Resizable summary pane** — replaced fixed-width summary sidebar with `react-resizable-panels`, persisted per-tab via localStorage.
- **`useDraggable` hook** — extracted reusable drag+resize logic from `FloatingChat` into `webview-ui/src/hooks/useDraggable.ts`.
- **Keyboard navigation** — `useRovingTabIndex` hook wired to all 7 list views (stashes, PRs, issues, notes, channels, projects, drive files) for Arrow/Home/End/Enter/Escape navigation.
- **AI cancellation** — `CancellationTokenSource` tracking in `AiService` with UI cancel button support.
- **Context parallelization** — `Promise.allSettled` in `_gatherContext` for concurrent context collection across tabs.
- **Performance** — deduplication guards in all stores, `useCallback`/`useMemo` audit, stable Zustand selectors, virtualized list preparation.
- **Error states** — user-friendly error boundaries, empty state illustrations, auth gates for all GitHub/Google-dependent tabs.
- **TypeScript strictness** — eliminated `any` types, added discriminated unions for webview messages, strict null checks throughout.
- **Tailwind consolidation** — replaced arbitrary pixel values with Tailwind spacing scale tokens.
- **Sidebar defaults** — Mattermost and Google Drive tree views default to collapsed visibility.

### Fixed

- **ESLint curly warnings** — auto-fixed 31 missing-brace warnings across the codebase.
- **PR comment threading** — correctly nest reply comments under parent reviews.
- **Stash conflict detection** — improved stderr parsing for merge conflict scenarios.
- **Mattermost export** — channel history export to Markdown with proper formatting.

### Testing

- **Handler unit tests** — new `stashHandlers.test.ts` with mocked `HandlerContext`, testing message routing, git operations, and postMessage responses.
- **113+ tests passing** — full suite verified after all refactors.

---

## [0.2.0] — 2026-02-12

### Changed

- **Rebranded to Superprompt Forge** — the extension broadens from stash-only to a general workspace toolkit. All user-facing labels (Command Palette, Activity Bar, panel titles, status bar) and internal command/setting IDs now use the `superprompt-forge` prefix.

### Added

- **Gist Notes — full CRUD** — create, edit, save, and delete Markdown notes backed by GitHub Gists, with GitHub OAuth authentication via `vscode.authentication`.
- **Gist Notes tree view** — dedicated "Gist Notes" sidebar view in the Superprompt Forge Activity Bar container, with:
    - Badge count, dynamic title, search/filter, welcome views for unauthenticated and empty states.
    - `GistNoteItem` with visibility icon (🌐 public / 📝 secret), relative timestamps, rich MarkdownString tooltip.
    - Context menu: Open, Copy Link, Toggle Visibility, Delete.
- **Webview Notes tab** — new tab bar in the Superprompt Forge panel with Stashes and Notes tabs:
    - **Notes list** — search, create inline, note cards with title/snippet/time/visibility badge.
    - **Note editor** — edit/preview toggle, Markdown rendering (markdown-it + highlight.js), title editing.
    - **Autosave** — 30-second debounce with countdown indicator (configurable via `superprompt-forge.notes.autosaveDelay`).
    - **Dirty state** — unsaved changes dot indicator, Cmd+S manual save, confirmation before switching notes.
    - **Responsive layout** — 640px breakpoint, narrow (replace) vs wide (50/50) mode.
    - **Auth gate** — sign-in prompt when not authenticated.
- **Markdown rendering** — `markdown-it` with `highlight.js` syntax highlighting, VS Code theme-aware `.markdown-body` CSS.
- **Toggle visibility** — delete-and-recreate gist to switch between public/secret, with user warning about ID/comments/stars loss.
- **Copy Gist link** — copy the GitHub Gist URL to clipboard from tree or editor.
- **GistService** — injectable `FetchFn` for testability, paginated listing (200 cap), rate-limit monitoring, structured error mapping.
- **2 new settings** — `superprompt-forge.notes.autosaveDelay` (seconds), `superprompt-forge.notes.defaultVisibility` (`secret`/`public`).
- **9 new commands** — `superprompt-forge.notes.create`, `.open`, `.delete`, `.copyLink`, `.toggleVisibility`, `.refresh`, `.search`, `.clearSearch`, plus existing `.signIn`/`.signOut`.
- **Unit tests** — `GistService` (list, get, create, update, delete, toggle visibility, error handling), `GistNoteItem` (label, icon, context value, highlights, accessibility).

## [0.1.0] — 2026-02-11

### Added

- **Sidebar tree view** — browse all git stashes in a dedicated Activity Bar container with badge count, dynamic title, and welcome views for no-workspace, no-git, and no-stashes states.
- **Rich stash items** — each stash shows message, branch, relative date, and lazy-loaded stats (files changed, insertions, deletions) in a MarkdownString tooltip.
- **File items with status** — expand a stash to see its files with M/A/D/R/C status icons; click any file to open a side-by-side diff.
- **Create stash** — three stash modes via QuickPick: All Changes, Staged Only, Include Untracked. Cancel-safe flow with progress indicator.
- **Apply / Pop** — apply or pop stashes with merge-conflict detection. Conflicts show a warning; pop leaves the stash in the list on conflict.
- **Drop / Clear** — drop a single stash or clear all, with configurable confirmation dialogs.
- **Show stash diff** — open the full `git stash show -p` output in a diff editor tab.
- **Show stash stats** — `superprompt-forge.showStats` command shows `git stash show --stat` in a plaintext editor.
- **Per-file diff viewer** — `TextDocumentContentProvider` with `superprompt-forge:` URI scheme (no temp files).
- **Webview panel** — rich React + Zustand + Tailwind CSS 4 panel in an editor tab:
    - Search/filter stashes by message, branch, or filename.
    - Stash cards with WIP indicator, branch badge, relative date, stats, hover actions.
    - Inline stash creation form with message input and mode selector.
    - Loading skeletons during refresh.
    - Full roving-tabindex keyboard navigation (Arrow Up/Down, Enter, Escape, Home/End).
    - Empty state with "Create Stash" button.
- **Auto-refresh** — git file watcher + window focus trigger, configurable via `superprompt-forge.autoRefresh`.
- **Status bar item** — shows `$(archive) N` stash count, click to focus tree view, hidden when 0.
- **Default keybinding** — `Cmd+Shift+S` (Mac) / `Ctrl+Shift+S` (Win/Linux) to create a stash.
- **7 user settings** — `autoRefresh`, `confirmOnDrop`, `confirmOnClear`, `showFileStatus`, `defaultIncludeUntracked`, `sortOrder`, `showBranchInDescription`.
- **Settings change listener** — tree view and webview auto-refresh when `superprompt-forge.*` settings change.
- **`pickStash()` helper** — single extracted QuickPick function used by all palette commands.
- **Structured `GitResult`** — `execGit()` returns `{ stdout, stderr, exitCode }`, never throws.
- **Injectable `ExecFn`** — `GitService` constructor accepts a custom exec function for unit testing.
- **Unit tests** — GitService (stash parsing, stats, file status, commands, conflict detection), `formatRelativeTime()`, `StashItem` / `StashFileItem` properties.
- **Integration tests** — extension activation, command registration, refresh smoke test.
- **Extension icon** — placeholder SVG/PNG in `images/`.
