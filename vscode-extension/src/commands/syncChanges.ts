import * as vscode from 'vscode';
import { log } from '../utils/logger';

/**
 * Phase 1 stub. Real implementation tracks file changes via a
 * FileWatcher + ExtractionOrchestrator and re-indexes only the
 * deltas. Tracked as Phase 2 Blocker B2 in
 * docs/superpowers/plans/2026-07-10-vscode-extension-phase2-blockers.md.
 */
export async function syncChangesCommand(): Promise<void> {
  log('syncChanges: stub invoked');
  const action = await vscode.window.showInformationMessage(
    'CodeGraph: Sync Changes is not yet implemented. For now, re-run "CodeGraph: Index Workspace" to pick up file changes.',
    'Index Workspace',
    'Dismiss'
  );
  if (action === 'Index Workspace') {
    await vscode.commands.executeCommand('codegraph.indexWorkspace');
  }
}
