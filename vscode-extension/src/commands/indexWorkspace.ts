import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getWorkspaceRoot, isCodegraphInitialized } from '../utils/workspace';
import { log, logError } from '../utils/logger';

export async function indexWorkspaceCommand() {
  const root = getWorkspaceRoot();
  if (!root) {
    vscode.window.showErrorMessage('CodeGraph: No workspace folder open');
    return;
  }

  if (!isCodegraphInitialized()) {
    const action = await vscode.window.showWarningMessage(
      'CodeGraph: Workspace not initialized. Initialize first?',
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
        const files = await collectFiles(root);
        log(`Found ${files.length} files to index`);

        if (token.isCancellationRequested) return;

        // Index files
        for (let i = 0; i < files.length; i++) {
          if (token.isCancellationRequested) return;

          const file = files[i];
          const percent = Math.round((i / files.length) * 100);
          progress.report({
            increment: (1 / files.length) * 100,
            message: `Indexing ${path.basename(file)} (${percent}%)`,
          });

          // TODO: Call ExtractionOrchestrator to parse file
          // For now, just log
          log(`Indexed: ${file}`);
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

async function collectFiles(root: string): Promise<string[]> {
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.c', '.cpp'];
  const exclude = ['node_modules', '.git', 'dist', 'build', '.codegraph'];

  const files: string[] = [];

  async function walk(dir: string) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!exclude.includes(entry.name)) {
          await walk(fullPath);
        }
      } else if (extensions.includes(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }

  await walk(root);
  return files;
}
