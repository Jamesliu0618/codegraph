import * as vscode from 'vscode';
import { log, logError } from './utils/logger';
import { isCodegraphInitialized, getWorkspaceRoot } from './utils/workspace';
import { initializeCommand } from './commands/initialize';
import { indexWorkspaceCommand } from './commands/indexWorkspace';
import { showStatusCommand } from './commands/showStatus';
import { querySymbolCommand } from './commands/querySymbol';
import { StatusBarManager } from './gui/statusBar';
import { CodeGraphCodeLensProvider } from './features/codeLensProvider';
import { CodeGraphHoverProvider } from './features/hoverProvider';
import { CodeGraphDefinitionProvider } from './features/definitionProvider';

export async function activate(context: vscode.ExtensionContext) {
  log('CodeGraph extension activating...');

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codegraph.initialize', initializeCommand),
    vscode.commands.registerCommand('codegraph.indexWorkspace', indexWorkspaceCommand),
    vscode.commands.registerCommand('codegraph.showStatus', showStatusCommand),
    vscode.commands.registerCommand('codegraph.querySymbol', querySymbolCommand)
  );

  // Status bar
  const statusBar = new StatusBarManager();
  context.subscriptions.push(statusBar);

  // Code Lens Provider
  const codeLensProvider = new CodeGraphCodeLensProvider();
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { scheme: 'file', language: '*' },
      codeLensProvider
    )
  );

  // Hover Provider
  const hoverProvider = new CodeGraphHoverProvider();
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      { scheme: 'file', language: '*' },
      hoverProvider
    )
  );

  // Definition Provider
  const definitionProvider = new CodeGraphDefinitionProvider();
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      { scheme: 'file', language: '*' },
      definitionProvider
    )
  );

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
