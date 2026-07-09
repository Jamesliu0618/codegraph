import * as vscode from 'vscode';
import * as path from 'path';
import { pickWorkspaceRoot, isCodegraphInitializedFor, listWorkspaceFiles } from '../utils/workspace';
import { log, logError } from '../utils/logger';

export async function indexWorkspaceCommand() {
  const root = await pickWorkspaceRoot('Select a workspace folder to index:');
  if (!root) {
    return;
  }

  if (!isCodegraphInitializedFor(root)) {
    const action = await vscode.window.showWarningMessage(
      `CodeGraph: ${path.basename(root)} is not initialized. Initialize first?`,
      'Initialize',
      'Cancel'
    );
    if (action === 'Initialize') {
      await vscode.commands.executeCommand('codegraph.initialize');
    }
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'CodeGraph: Indexing workspace...',
      cancellable: true,
    },
    async (progress, token) => {
      try {
        // Collect files
        progress.report({ increment: 0, message: 'Scanning files...' });
        const { files, errorCount } = await listWorkspaceFiles(root);
        log(`Found ${files.length} files to index (${errorCount} dir read error(s))`);

        if (token.isCancellationRequested) return;

        // Index files
        for (let i = 0; i < files.length; i++) {
          if (token.isCancellationRequested) return;

          const file = files[i];
          const percent = Math.round((i / files.length) * 100);
          progress.report({
            increment: (1 / files.length) * 100,
            message: `Indexing ${path.basename(file.absPath)} (${percent}%)`,
          });

          // TODO: Call ExtractionOrchestrator to parse file
          // For now, just log
          log(`Indexed: ${file.absPath}`);
        }

        log('Indexing completed successfully');
        vscode.window.showInformationMessage(
          `CodeGraph: Indexed ${files.length} files successfully`
        );
      } catch (error) {
        logError('Indexing failed', error as Error);
        vscode.window.showErrorMessage(`CodeGraph: Indexing failed: ${(error as Error).message}`);
      }
    }
  );
}
