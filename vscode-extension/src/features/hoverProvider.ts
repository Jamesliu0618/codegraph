import * as vscode from 'vscode';

export class CodeGraphHoverProvider implements vscode.HoverProvider {
  public provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.Hover | undefined {
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) return undefined;

    const word = document.getText(wordRange);

    // TODO: Query CodeGraph for call relationships
    // For now, provide placeholder
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;
    markdown.supportHtml = true;

    markdown.appendMarkdown(`## ${word}\n\n`);
    markdown.appendMarkdown(`---\n\n`);
    markdown.appendMarkdown(`📞 **Called by:** _Not yet indexed_\n\n`);
    markdown.appendMarkdown(`👥 **Calls:** _Not yet indexed_\n\n`);
    markdown.appendMarkdown(`📁 **Impact:** _Not yet indexed_\n\n`);
    markdown.appendMarkdown(`---\n\n`);
    markdown.appendMarkdown(`_CodeGraph: Hover information will be available after core integration_`);

    return new vscode.Hover(markdown, wordRange);
  }
}
