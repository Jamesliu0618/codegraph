import * as vscode from 'vscode';
import * as path from 'path';
import { getWorkspaceRoot, isCodegraphInitializedFor } from '../utils/workspace';
import { CodeGraph } from '../core';

export class CodeGraphDefinitionProvider implements vscode.DefinitionProvider {
  public async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Definition | undefined> {
    const root = getWorkspaceRoot();
    if (!root || !isCodegraphInitializedFor(root)) {
      return undefined;
    }

    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) return undefined;

    const word = document.getText(wordRange);

    let cg: CodeGraph | undefined;
    try {
      cg = await CodeGraph.open(root);
      const nodes = cg.getNodesByName(word);
      if (nodes.length === 0) {
        return undefined;
      }

      return nodes.map(n => {
        const absPath = path.resolve(root, n.file_path);
        const uri = vscode.Uri.file(absPath);
        const range = new vscode.Range(
          new vscode.Position(n.start_line, n.start_column),
          new vscode.Position(n.end_line, n.end_column)
        );
        return new vscode.Location(uri, range);
      });
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
}
