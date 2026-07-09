import * as vscode from 'vscode';
import { isCodegraphInitializedFor, getWorkspaceRoot } from '../utils/workspace';

export class CodeGraphHoverProvider implements vscode.HoverProvider {
  public provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.Hover | undefined {
    // Don't show placeholder hover spam. Without a real graph we have
    // nothing useful to display — returning undefined lets VS Code fall
    // back to its built-in symbol hover. Real caller/callee info
    // arrives with Phase 2 Blocker B2.
    const root = getWorkspaceRoot();
    if (!root || !isCodegraphInitializedFor(root)) {
      return undefined;
    }
    return undefined;
  }
}
