import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function getWorkspaceRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }
  return folders[0].uri.fsPath;
}

export function getCodegraphDir(): string | undefined {
  const root = getWorkspaceRoot();
  if (!root) return undefined;
  return path.join(root, '.codegraph');
}

export function isCodegraphInitialized(): boolean {
  const dir = getCodegraphDir();
  if (!dir) return false;
  return fs.existsSync(dir) && fs.existsSync(path.join(dir, 'codegraph.db'));
}

export function getDatabasePath(): string | undefined {
  const dir = getCodegraphDir();
  if (!dir) return undefined;
  return path.join(dir, 'codegraph.db');
}
