import * as vscode from 'vscode';

export class CodeGraphCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  constructor() {
    // Refresh when document changes
    vscode.workspace.onDidChangeTextDocument(() => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    const codeLenses: vscode.CodeLens[] = [];

    // TODO: Query CodeGraph for caller/callee counts
    // For now, provide placeholder implementation
    const text = document.getText();
    const functionRegex = /(?:function|async function)\s+(\w+)/g;
    let match;

    while ((match = functionRegex.exec(text)) !== null) {
      const line = document.lineAt(document.positionAt(match.index).line);
      const range = line.range;

      // Placeholder: show "N callers · M callees"
      codeLenses.push(
        new vscode.CodeLens(range, {
          title: '$(people) 0 callers · $(phone) 0 callees',
          command: 'codegraph.querySymbol',
          arguments: [match[1]],
        })
      );
    }

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
