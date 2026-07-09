import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getCodegraphDir, isCodegraphInitialized } from '../utils/workspace';

export async function showStatusCommand() {
  if (!isCodegraphInitialized()) {
    vscode.window.showWarningMessage('CodeGraph: Workspace not initialized');
    return;
  }

  const cgDir = getCodegraphDir()!;
  const dbPath = path.join(cgDir, 'codegraph.db');
  const stats = fs.statSync(dbPath);
  const dbSizeMB = (stats.size / 1024 / 1024).toFixed(2);

  // TODO: Query actual node/edge counts from database
  const nodeCount = 'N/A';
  const edgeCount = 'N/A';
  const fileCount = 'N/A';

  const message = `CodeGraph Status:
Database: ${dbSizeMB} MB
Nodes: ${nodeCount}
Edges: ${edgeCount}
Files: ${fileCount}`;

  vscode.window.showInformationMessage(message, { modal: true });
}
