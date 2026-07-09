import * as vscode from 'vscode';
import * as path from 'path';

export class GraphViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codegraph.graphView';

  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'src', 'gui', 'media'),
      ],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'searchSymbol':
            await vscode.commands.executeCommand('codegraph.querySymbol', message.symbol);
            return;
          case 'navigateToFile':
            const document = await vscode.workspace.openTextDocument(message.file);
            await vscode.window.showTextDocument(document);
            return;
        }
      },
      undefined,
      []
    );
  }

  public updateStats(stats: { files: number; nodes: number; edges: number }) {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'updateStats',
        stats,
      });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'gui', 'media', 'graphView.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'gui', 'media', 'graphView.css')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <link href="${styleUri}" rel="stylesheet">
  <title>CodeGraph View</title>
</head>
<body>
  <div id="app">
    <div class="search-box">
      <input type="text" id="search" placeholder="Search symbols..." />
    </div>
    <div class="content">
      <div class="panel files">
        <h3>Files</h3>
        <div id="file-tree"></div>
      </div>
      <div class="panel graph">
        <h3>Graph</h3>
        <div id="graph-container"></div>
      </div>
    </div>
    <div class="stats">
      <span id="stats">Loading...</span>
    </div>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
