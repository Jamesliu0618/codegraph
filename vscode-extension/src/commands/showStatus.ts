import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { pickWorkspaceRoot, isCodegraphInitializedFor, getDatabasePathFor } from '../utils/workspace';

export async function showStatusCommand() {
  const root = await pickWorkspaceRoot('Select a workspace folder to show status for:');
  if (!root) {
    return;
  }

  if (!isCodegraphInitializedFor(root)) {
    vscode.window.showWarningMessage(`CodeGraph: ${path.basename(root)} is not initialized`);
    return;
  }

  const dbPath = getDatabasePathFor(root);
  const stats = fs.statSync(dbPath);
  const dbSizeMB = (stats.size / 1024 / 1024).toFixed(2);

  // TODO: Query actual node/edge counts from database
  const nodeCount = 'N/A';
  const edgeCount = 'N/A';
  const fileCount = 'N/A';

  const message = `CodeGraph Status (${path.basename(root)}):
Database: ${dbSizeMB} MB
Nodes: ${nodeCount}
Edges: ${edgeCount}
Files: ${fileCount}`;

  vscode.window.showInformationMessage(message, { modal: true });
}
