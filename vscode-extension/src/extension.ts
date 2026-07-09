import * as vscode from 'vscode';
import { log, logError } from './utils/logger';
import { isCodegraphInitialized, getWorkspaceRoot } from './utils/workspace';
import { initializeCommand } from './commands/initialize';
import { indexWorkspaceCommand } from './commands/indexWorkspace';
import { StatusBarManager } from './gui/statusBar';

export async function activate(context: vscode.ExtensionContext) {
  log('CodeGraph extension activating...');

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codegraph.initialize', initializeCommand),
    vscode.commands.registerCommand('codegraph.indexWorkspace', indexWorkspaceCommand)
  );

  // Status bar
  const statusBar = new StatusBarManager();
  context.subscriptions.push(statusBar);

  // Check if workspace is initialized
  const root = getWorkspaceRoot();
  if (!root) {
    log('No workspace folder open');
    return;
  }

  if (!isCodegraphInitialized()) {
    const action = await vscode.window.showInformationMessage(
      'CodeGraph: This workspace is not indexed. Would you like to initialize?',
      'Initialize',
      'Later'
    );
    if (action === 'Initialize') {
      await vscode.commands.executeCommand('codegraph.initialize');
    }
  }

  log('CodeGraph extension activated');
}

export function deactivate() {
  log('CodeGraph extension deactivating...');
}
