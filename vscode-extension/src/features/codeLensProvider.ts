import * as vscode from 'vscode';
import { isCodegraphInitializedFor, getWorkspaceRoot } from '../utils/workspace';

export class CodeGraphCodeLensProvider implements vscode.CodeLensProvider, vscode.Disposable {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  private _disposables: vscode.Disposable[] = [];

  constructor() {
    // Refresh when document changes
    this._disposables.push(
      vscode.workspace.onDidChangeTextDocument(() => {
        this._onDidChangeCodeLenses.fire();
      })
    );
  }

  public dispose(): void {
    this._onDidChangeCodeLenses.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      try {
        d?.dispose();
      } catch {
        // Best-effort cleanup; one failing disposable must not block the rest.
      }
    }
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    // Only run on languages the regex actually understands. Without this
    // gate, we'd produce 0 lenses on .py/.go/.rs etc. and look broken.
    // Other languages will be enabled when their CodeGraph extractors land.
    const supportedLanguages = new Set(['typescript', 'typescriptreact', 'javascript', 'javascriptreact']);
    if (!supportedLanguages.has(document.languageId)) {
      return [];
    }

    // Don't show fake numbers. Without a real graph we have no honest
    // caller/callee counts to show. Returning [] hides Code Lens
    // entirely until the workspace is initialized AND indexed
    // (Phase 2 Blocker B2).
    const root = getWorkspaceRoot();
    if (!root || !isCodegraphInitializedFor(root)) {
      return [];
    }

    const codeLenses: vscode.CodeLens[] = [];

    // TODO: Query CodeGraph for caller/callee counts and show real
    // numbers (Phase 2 Blocker B2). For now, no Code Lens is rendered
    // when the workspace IS initialized but the graph is still empty,
    // because the regex match below would otherwise attach a misleading
    // "0 callers · 0 callees" label to every TS/JS function.
    return codeLenses;
  }

  public resolveCodeLens(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken
  ): vscode.CodeLens {
    return codeLens;
  }

  public refresh() {
    this._onDidChangeCodeLenses.fire();
  }
}
