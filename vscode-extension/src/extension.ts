import * as vscode from 'vscode';
import { log, logError } from './utils/logger';
import { isCodegraphInitialized, getWorkspaceRoot } from './utils/workspace';

export async function activate(context: vscode.ExtensionContext) {
  log('CodeGraph extension activating...');

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
