import * as vscode from 'vscode';

export class CodeGraphDefinitionProvider implements vscode.DefinitionProvider {
  public async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Definition | undefined> {
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) return undefined;

    const word = document.getText(wordRange);

    // TODO: Query CodeGraph for symbol definition location
    // For now, return undefined (no definition found)
    // This will be replaced with actual graph query

    return undefined;
  }
}
