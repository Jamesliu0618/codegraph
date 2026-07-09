import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { pickWorkspaceRoot, getCodegraphDirFor, isCodegraphInitializedFor } from '../utils/workspace';
import { log, logError } from '../utils/logger';
import { DatabaseConnection } from '../core/db';

export async function initializeCommand() {
  const root = await pickWorkspaceRoot('Select a workspace folder to initialize:');
  if (!root) {
    return;
  }

  const cgDir = getCodegraphDirFor(root);

  if (isCodegraphInitializedFor(root)) {
    const action = await vscode.window.showWarningMessage(
      `CodeGraph: ${path.basename(root)} is already initialized. Re-initialize?`,
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
        const dbPath = path.join(cgDir, 'codegraph.db');
        const db = DatabaseConnection.initialize(dbPath);
        db.close();

        progress.report({ increment: 100, message: 'Done!' });
        log(`Workspace initialized successfully: ${root}`);
        vscode.window.showInformationMessage('CodeGraph: Workspace initialized successfully');
      } catch (error) {
        logError('Failed to initialize workspace', error as Error);
        vscode.window.showErrorMessage(`CodeGraph: Initialization failed: ${(error as Error).message}`);
      }
    }
  );
}
