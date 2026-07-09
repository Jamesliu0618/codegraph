import * as vscode from 'vscode';
import { log } from '../utils/logger';
import { getWorkspaceRoots } from '../utils/workspace';

export class CopilotIntegration {
  public async register(): Promise<void> {
    const roots = getWorkspaceRoots();
    if (roots.length === 0) {
      log('Copilot: No workspace root, skipping registration');
      return;
    }
    const root = roots[0];

    // NOTE: We intentionally do NOT write `.vscode/mcp.json` here.
    // The CLI command ("codegraph") is not installed on the user's PATH,
    // and Copilot Coding Agent would fail to spawn it. Writing a broken
    // config would pollute the user's .vscode/ directory and cause
    // confusing connection errors.
    //
    // This registration is a stub for Phase 1 — see Phase 2 Blocker B3
    // (docs/superpowers/plans/2026-07-10-vscode-extension-phase2-blockers.md).
    log(`Copilot: integration pending — workspace root: ${root}`);
  }
}
