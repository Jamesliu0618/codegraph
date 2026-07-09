import * as vscode from 'vscode';
import { log, logError } from './utils/logger';
import { isCodegraphInitialized, getWorkspaceRoots, getInitializationSummary } from './utils/workspace';
import { initializeCommand } from './commands/initialize';
import { indexWorkspaceCommand } from './commands/indexWorkspace';
import { showStatusCommand } from './commands/showStatus';
import { querySymbolCommand } from './commands/querySymbol';
import { syncChangesCommand } from './commands/syncChanges';
import { StatusBarManager } from './gui/statusBar';
import { CodeGraphCodeLensProvider } from './features/codeLensProvider';
import { CodeGraphHoverProvider } from './features/hoverProvider';
import { CodeGraphDefinitionProvider } from './features/definitionProvider';
import { McpManager } from './mcp/mcpManager';
import { CopilotIntegration } from './mcp/copilotIntegration';
import { GraphViewProvider } from './gui/graphViewProvider';

export async function activate(context: vscode.ExtensionContext) {
  log('CodeGraph extension activating...');

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codegraph.initialize', initializeCommand),
    vscode.commands.registerCommand('codegraph.indexWorkspace', indexWorkspaceCommand),
    vscode.commands.registerCommand('codegraph.showStatus', showStatusCommand),
    vscode.commands.registerCommand('codegraph.querySymbol', querySymbolCommand),
    vscode.commands.registerCommand('codegraph.syncChanges', syncChangesCommand)
  );

  // Status bar
  const statusBar = new StatusBarManager();
  context.subscriptions.push(statusBar);

  // Code Lens Provider
  const codeLensProvider = new CodeGraphCodeLensProvider();
  context.subscriptions.push(codeLensProvider);
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

  // MCP Manager
  const mcpManager = new McpManager();
  await mcpManager.start();
  context.subscriptions.push(mcpManager);

  // Copilot Integration
  const copilot = new CopilotIntegration();
  await copilot.register();

  // Graph View Provider
  const graphViewProvider = new GraphViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      GraphViewProvider.viewType,
      graphViewProvider
    )
  );

  // Check if workspace is initialized
  const roots = getWorkspaceRoots();
  if (roots.length === 0) {
    log('No workspace folder open');
    return;
  }

  const summary = getInitializationSummary();
  if (summary.initialized === 0) {
    const action = await vscode.window.showInformationMessage(
      `CodeGraph: This workspace is not indexed (${summary.total} folder${summary.total === 1 ? '' : 's'}). Initialize?`,
      'Initialize',
      'Later'
    );
    if (action === 'Initialize') {
      await vscode.commands.executeCommand('codegraph.initialize');
    }
  } else if (summary.initialized < summary.total) {
    log(`CodeGraph: ${summary.initialized} of ${summary.total} folders are indexed`);
  }

  log('CodeGraph extension activated');
}

export function deactivate() {
  log('CodeGraph extension deactivating...');
}
