import * as vscode from 'vscode';
import { log, logError } from '../utils/logger';
import { getWorkspaceRoot } from '../utils/workspace';

export class McpManager {
  private statusBarItem: vscode.StatusBarItem;
  private isRunning: boolean = false;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = 'codegraph.showStatus';
    this.updateStatusBar();
  }

  public async start(): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) {
      log('MCP: No workspace root, skipping MCP server start');
      return;
    }

    try {
      log('MCP: Starting server...');
      this.statusBarItem.text = '$(sync~spin) MCP: Starting...';
      this.statusBarItem.show();

      // TODO: Start actual MCP server process
      // For now, just update status
      this.isRunning = true;
      this.updateStatusBar();
      log('MCP: Server started successfully');
    } catch (error) {
      logError('MCP: Failed to start server', error as Error);
      this.statusBarItem.text = '$(error) MCP: Failed';
      this.statusBarItem.tooltip = 'MCP server failed to start';
    }
  }

  public stop(): void {
    this.isRunning = false;
    this.updateStatusBar();
    log('MCP: Server stopped');
  }

  private updateStatusBar(): void {
    if (this.isRunning) {
      this.statusBarItem.text = '$(check) MCP: Ready';
      this.statusBarItem.tooltip = 'CodeGraph MCP server is running';
      this.statusBarItem.backgroundColor = undefined;
    } else {
      this.statusBarItem.text = '$(circle-slash) MCP: Stopped';
      this.statusBarItem.tooltip = 'CodeGraph MCP server is not running';
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground'
      );
    }
    this.statusBarItem.show();
  }

  public dispose(): void {
    this.stop();
    this.statusBarItem.dispose();
  }
}
