# CodeGraph VS Code Extension — Phase 2 Blockers

Status: tracked from the post-Phase-1 code review (2026-07-10). These items were
deliberately deferred from Phase 1 (the UI shell) and **must land before the
extension delivers real value to users**.

> Items that were originally labeled [必須修復] in the review were reclassified
> here as [Phase 2 Blocker] after verifying that the Phase 1 implementation plan
> explicitly scoped them out. Do not start Phase 2 work without reading this.

## B1. Real database initialization

**File:** [vscode-extension/src/commands/initialize.ts](../../../vscode-extension/src/commands/initialize.ts)

**Current state:** writes an empty file as `codegraph.db`. `isCodegraphInitializedFor()`
returns `true` based on file existence, so downstream code thinks the DB is ready
when it is actually empty.

**Acceptance criteria:**
- The created `codegraph.db` is a valid SQLite database with the schema from
  `src/core/db/schema.sql` (or a v0-compatible subset).
- `isCodegraphInitializedFor()` only returns `true` when the DB has the expected
  schema version row. A bare empty file is treated as "not initialized".

**Depends on:** extracting or re-publishing the `core/db/schema.sql` file from
the parent CodeGraph project into the extension's bundling path.

## B2. Indexing pipeline integration

**File:** [vscode-extension/src/commands/indexWorkspace.ts](../../../vscode-extension/src/commands/indexWorkspace.ts)

**Current state:** the index loop `log()`s each file and increments progress,
but no actual extraction happens. After running the command, `.codegraph/`
contains an empty DB and the `CodeLens` / `Hover` / `Definition` providers have
nothing to read.

**Acceptance criteria:**
- Each scanned file is parsed by the `ExtractionOrchestrator` (or a slimmed-down
  in-extension equivalent) and produces nodes + edges in the DB.
- Progress events include real `extract / resolve / persist` substeps.
- The `CodeLensProvider` can read caller/callee counts and render real numbers
  (e.g. `$(people) 3 callers · $(phone) 7 callees`).
- The `HoverProvider` and `DefinitionProvider` use the same data path.

**Depends on:** B1, plus either embedding `@colbymchenry/codegraph`'s core into
the extension or shelling out to a sibling CLI process. The design doc
[2026-07-10-vscode-extension-design.md](../specs/2026-07-10-vscode-extension-design.md)
picked embedding; revisit if the bundle size blows past VS Code's 50 MB ceiling.

## B3. MCP server lifecycle

**File:** [vscode-extension/src/mcp/mcpManager.ts](../../../vscode-extension/src/mcp/mcpManager.ts)

**Current state:** the status bar flips to "MCP: Ready" but no process is
actually spawned. Users with `mcp.json` configured for the Copilot Coding Agent
will get connection failures.

**Acceptance criteria:**
- `McpManager.start()` spawns the MCP server (embedded or via `codegraph serve --mcp`).
- `McpManager.dispose()` (called on extension deactivation) sends SIGTERM and
  waits for clean shutdown; falls back to SIGKILL after a timeout.
- Status bar accurately reflects `starting | running | failed | stopped`.

**Depends on:** the core MCP server being a stable, child-process-friendly binary.

## B4. Settings-driven configuration

**File:** [vscode-extension/package.json](../../package.json) (lacks a
`contributes.configuration` block).

**Current state:** the list of indexed file extensions and excluded directories
in `indexWorkspace.ts > collectFiles()` is hard-coded. The exclude list does
not respect `.gitignore`, `.codegraphignore`, or VS Code's
`files.exclude` / `search.exclude` settings.

**Acceptance criteria:**
- Exposed as `codegraph.indexer.includeLanguages` and
  `codegraph.indexer.excludePatterns` under `contributes.configuration`.
- Honour `files.exclude` and `search.exclude` by default.
- Optionally honour `.codegraphignore` (gitignore-syntax) at the workspace root.

## B5. Workspace-state change listeners

**File:** [vscode-extension/src/extension.ts](../../../vscode-extension/src/extension.ts)

**Current state:** activation checks the initialization state once. Adding or
removing workspace folders, or initializing from the command palette, does not
refresh the status bar or providers until the next reload.

**Acceptance criteria:**
- Listen to `vscode.workspace.onDidChangeWorkspaceFolders()` and update
  `StatusBarManager` and providers accordingly.
- After `codegraph.initialize` completes, the status bar transitions to
  "Indexed" without requiring a manual refresh command.

## B6. Multi-root "index all" command

**File:** [vscode-extension/src/commands/indexWorkspace.ts](../../../vscode-extension/src/commands/indexWorkspace.ts)

**Current state:** the pickWorkspaceRoot flow lets the user index one folder at
a time. In multi-root workspaces with 5+ folders, this is friction.

**Acceptance criteria:**
- A `codegraph.indexAll` command that iterates every workspace folder, calling
  the per-folder pipeline in sequence (or in parallel, capped by CPU count).
- The status bar shows per-folder progress when the bulk command is running.

---

## Out of scope (intentionally)

These were raised in the review but explicitly **not** added to the blocker list:

- `querySymbolCommand` showing two notifications in a row (UX polish — fix
  opportunistically when the real search lands).
- `logger.ts` thread safety (Node.js single-threaded; over-engineering).
- `cgDir` variable naming (subjective).
- WebView search debounce (only matters once real search is wired up).

---

## Verification gate

Before tagging the next release that includes Phase 2 work:

1. All B1–B6 items resolved and unit-tested.
2. `codegraph.showStatus` displays real (non-`N/A`) node / edge / file counts.
3. `codegraph.indexWorkspace` followed by `codegraph.querySymbol foo` actually
   returns real candidates from the graph.
4. `MCP: Ready` means the server is verifiably responsive (`mcp/listTools`
   round-trip succeeds).
