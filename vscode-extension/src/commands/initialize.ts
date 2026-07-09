import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getWorkspaceRoot, getCodegraphDir } from '../utils/workspace';
import { log, logError } from '../utils/logger';

export async function initializeCommand() {
  const root = getWorkspaceRoot();
  if (!root) {
    vscode.window.showErrorMessage('CodeGraph: No workspace folder open');
    return;
  }

  const cgDir = getCodegraphDir()!;

  if (fs.existsSync(path.join(cgDir, 'codegraph.db'))) {
    const action = await vscode.window.showWarningMessage(
      'CodeGraph: This workspace is already initialized. Re-initialize?',
      'Re-initialize',
      'Cancel'
    );
    if (action !== 'Re-initialize') return;
    fs.rmSync(cgDir, { recursive: true, force: true });
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'CodeGraph: Initializing...',
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ increment: 0, message: 'Creating .codegraph directory...' });
        fs.mkdirSync(cgDir, { recursive: true });

        progress.report({ increment: 50, message: 'Initializing database...' });
        // TODO: Initialize SQLite database with schema
        // For now, just create a placeholder
        fs.writeFileSync(path.join(cgDir, 'codegraph.db'), '');

        progress.report({ increment: 100, message: 'Done!' });
        log('Workspace initialized successfully');
        vscode.window.showInformationMessage('CodeGraph: Workspace initialized successfully');
      } catch (error) {
        logError('Failed to initialize workspace', error as Error);
        vscode.window.showErrorMessage(`CodeGraph: Initialization failed: ${(error as Error).message}`);
      }
    }
  );
}
