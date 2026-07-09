import * as vscode from 'vscode';
import * as path from 'path';
import { isCodegraphInitializedFor, getWorkspaceRoot } from '../utils/workspace';
import { CodeGraph } from '../core';

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

  public async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    const root = getWorkspaceRoot();
    if (!root || !isCodegraphInitializedFor(root)) {
      return [];
    }

    const supportedLanguages = new Set(['typescript', 'typescriptreact', 'javascript', 'javascriptreact']);
    if (!supportedLanguages.has(document.languageId)) {
      return [];
    }

    let cg: CodeGraph | undefined;
    try {
      cg = await CodeGraph.open(root);
      const relativePath = path.relative(root, document.fileName).replace(/\\/g, '/');
      const nodes = cg.getNodesInFile(relativePath);
      
      const lenses: vscode.CodeLens[] = [];
      for (const n of nodes) {
        if (n.kind === 'function' || n.kind === 'method' || n.kind === 'class') {
          const range = new vscode.Range(n.start_line, n.start_column, n.start_line, n.end_column);
          const lens = new vscode.CodeLens(range);
          (lens as any).nodeId = n.id;
          (lens as any).projectRoot = root;
          lenses.push(lens);
        }
      }
      return lenses;
    } catch {
      return [];
    } finally {
      if (cg) {
        try {
          cg.close();
        } catch {
          // best effort
        }
      }
    }
  }

  public async resolveCodeLens(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens | undefined> {
    const nodeId = (codeLens as any).nodeId;
    const root = (codeLens as any).projectRoot;
    if (!nodeId || !root) return undefined;

    let cg: CodeGraph | undefined;
    try {
      cg = await CodeGraph.open(root);
      const node = cg.getNode(nodeId);
      if (!node) return undefined;

      const callers = cg.getCallers(nodeId);
      const callees = cg.getCallees(nodeId);

      codeLens.command = {
        title: `$(people) ${callers.length} callers · $(phone) ${callees.length} callees`,
        command: 'codegraph.querySymbol',
        arguments: [node.name],
      };
      return codeLens;
    } catch {
      return undefined;
    } finally {
      if (cg) {
        try {
          cg.close();
        } catch {
          // best effort
        }
      }
    }
  }

  public refresh() {
    this._onDidChangeCodeLenses.fire();
  }
}
