import * as vscode from 'vscode';

export async function querySymbolCommand() {
  const symbol = await vscode.window.showInputBox({
    prompt: 'Enter symbol name to search',
    placeHolder: 'e.g., calculateTotal, MyClass',
  });

  if (!symbol) return;

  // TODO: Implement actual symbol search using FTS5
  vscode.window.showInformationMessage(`CodeGraph: Searching for "${symbol}"...`);

  // Placeholder: show message that search is not yet implemented
  vscode.window.showWarningMessage(
    'CodeGraph: Symbol search will be available after core integration'
  );
}
