import * as vscode from 'vscode';
import { isCodegraphInitializedFor, getWorkspaceRoot } from '../utils/workspace';
import { CodeGraph } from '../core';

export class CodeGraphHoverProvider implements vscode.HoverProvider {
  public async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | undefined> {
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

      const hoverContents: vscode.MarkdownString[] = [];

      for (const n of nodes) {
        const md = new vscode.MarkdownString();
        md.appendCodeblock(n.signature || `${n.kind} ${n.name}`, n.language);

        const callers = cg.getCallers(n.id);
        const callees = cg.getCallees(n.id);
        
        md.appendMarkdown(`\n\n👥 **Callers**: ${callers.length} | 📞 **Callees**: ${callees.length}`);

        if (n.docstring) {
          md.appendMarkdown(`\n\n---\n\n${n.docstring}`);
        }
        hoverContents.push(md);
      }

      return new vscode.Hover(hoverContents, wordRange);
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
