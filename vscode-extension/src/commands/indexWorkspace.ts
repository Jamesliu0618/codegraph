import * as vscode from 'vscode';
import * as path from 'path';
import { pickWorkspaceRoot, isCodegraphInitializedFor } from '../utils/workspace';
import { log, logError } from '../utils/logger';
import { CodeGraph } from '../core';

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
      title: 'CodeGraph: Indexing...',
      cancellable: true,
    },
    async (vscodeProgress, token) => {
      const controller = new AbortController();
      token.onCancellationRequested(() => {
        controller.abort();
      });

      let cg: CodeGraph | undefined;

      try {
        vscodeProgress.report({ increment: 0, message: 'Opening CodeGraph project...' });
        cg = await CodeGraph.open(root);

        let lastPercent = 0;
        const result = await cg.indexAll({
          signal: controller.signal,
          onProgress: (p) => {
            if (token.isCancellationRequested) return;

            let phaseLabel = 'Indexing';
            if (p.phase === 'scanning') phaseLabel = 'Scanning files';
            else if (p.phase === 'extracting') phaseLabel = 'Extracting symbols';
            else if (p.phase === 'resolving') phaseLabel = 'Resolving references';
            else if (p.phase === 'persisting') phaseLabel = 'Saving to database';

            const fileLabel = p.file ? `: ${path.basename(p.file)}` : '';
            let percentLabel = '';
            let increment = 0;

            if (p.total && p.total > 0) {
              const currentPercent = Math.round((p.current / p.total) * 100);
              percentLabel = ` (${currentPercent}%)`;
              const delta = currentPercent - lastPercent;
              if (delta > 0) {
                increment = delta;
                lastPercent = currentPercent;
              }
            }

            vscodeProgress.report({
              increment,
              message: `${phaseLabel}${fileLabel}${percentLabel}`,
            });
          }
        });

        if (token.isCancellationRequested) {
          log('Indexing cancelled by user');
          vscode.window.showInformationMessage('CodeGraph: Indexing cancelled');
          return;
        }

        if (result.success) {
          log(`Indexing completed successfully: ${result.filesIndexed} files indexed, ${result.nodesCreated} nodes, ${result.edgesCreated} edges created.`);
          vscode.window.showInformationMessage(
            `CodeGraph: Indexed ${result.filesIndexed} files successfully (${result.nodesCreated} nodes, ${result.edgesCreated} edges)`
          );
        } else {
          const errMsg = result.errors?.[0]?.message ?? 'Unknown indexing error';
          throw new Error(errMsg);
        }
      } catch (error) {
        logError('Indexing failed', error as Error);
        vscode.window.showErrorMessage(`CodeGraph: Indexing failed: ${(error as Error).message}`);
      } finally {
        if (cg) {
          try {
            cg.close();
          } catch {
            // best effort cleanup
          }
        }
      }
    }
  );
}
