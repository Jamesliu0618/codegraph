import * as vscode from 'vscode';
import { log } from '../utils/logger';
import { getWorkspaceRoots } from '../utils/workspace';

export class McpManager {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      99  // different priority from the main CodeGraph status bar
    );
    this.statusBarItem.command = 'codegraph.showStatus';
    this.updateStatusBar();
  }

  public async start(): Promise<void> {
    const roots = getWorkspaceRoots();
    if (roots.length === 0) {
      log('MCP: No workspace root, skipping MCP server start');
      return;
    }

    // Phase 1 stub — see Phase 2 Blocker B3. We don't actually spawn
    // a process yet because the underlying MCP server binary isn't
    // packaged. Showing "MCP: Ready" with no process behind it would
    // mislead users, so the status bar shows the truthful state.
    this.statusBarItem.text = '$(circle-slash) MCP: pending';
    this.statusBarItem.tooltip =
      'CodeGraph MCP server integration is pending (Phase 2 Blocker B3)';
    this.statusBarItem.backgroundColor = new vscode.ThemeColor(
      'statusBarItem.warningBackground'
    );
    this.statusBarItem.show();
    log('MCP: stub state — no process spawned');
  }

  public stop(): void {
    this.statusBarItem.hide();
  }

  private updateStatusBar(): void {
    // Initial state is the "pending" state — set in start().
  }

  public dispose(): void {
    this.stop();
    this.statusBarItem.dispose();
  }
}
