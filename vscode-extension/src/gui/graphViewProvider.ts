import * as vscode from 'vscode';
import * as path from 'path';
import {
  getWorkspaceRoots,
  listWorkspaceFiles,
  getWorkspaceStats,
  FileNode,
} from '../utils/workspace';
import { logError } from '../utils/logger';

export class GraphViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codegraph.graphView';

  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  private _lastActiveRoot?: string;
  private _currentSessionId = 0;

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      // Media assets are copied to dist/media/ by esbuild so the
      // packaged .vsix can serve them. .vscodeignore excludes src/**.
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'dist', 'media'),
      ],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Listen for active editor changes to refresh the view for multi-root workspaces
    const activeEditorListener = vscode.window.onDidChangeActiveTextEditor(async () => {
      await this._pushInitialState(false);
    });
    webviewView.onDidDispose(() => {
      activeEditorListener.dispose();
    });

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(
      async (message) => {
        try {
          switch (message.command) {
            case 'ready':
              // WebView just mounted — push the first batch of state.
              await this._pushInitialState(true);
              return;
            case 'refreshFiles':
              await this.refresh();
              return;
            case 'searchFiles':
              await this._pushSearchResults(message.query ?? '');
              return;
            case 'navigateToFile': {
              const document = await vscode.workspace.openTextDocument(message.file);
              await vscode.window.showTextDocument(document);
              return;
            }
            case 'initialize':
              await vscode.commands.executeCommand('codegraph.initialize');
              await this.refresh();
              return;
            case 'indexWorkspace':
              await vscode.commands.executeCommand('codegraph.indexWorkspace');
              await this.refresh();
              return;
          }
        } catch (err) {
          logError('GraphView message handler failed', err as Error);
          this._view?.webview.postMessage({
            type: 'error',
            message: (err as Error).message,
          });
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

  public async refresh(): Promise<void> {
    await this._pushInitialState(true);
  }

  private async _pushInitialState(force = false): Promise<void> {
    const root = this._activeRoot();
    if (!force && root === this._lastActiveRoot) {
      return;
    }
    this._lastActiveRoot = root;
    const sessionId = ++this._currentSessionId;
    await this._pushFiles(root, sessionId);
    await this._pushStats(root, sessionId);
  }

  private _activeRoot(): string | undefined {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      const folder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
      if (folder) {
        return folder.uri.fsPath;
      }
    }
    if (this._lastActiveRoot) {
      const roots = getWorkspaceRoots();
      if (roots.includes(this._lastActiveRoot)) {
        return this._lastActiveRoot;
      }
    }
    const roots = getWorkspaceRoots();
    return roots.length > 0 ? roots[0] : undefined;
  }

  private async _pushFiles(root: string | undefined, sessionId: number): Promise<void> {
    if (!root) {
      if (sessionId === this._currentSessionId) {
        this._view?.webview.postMessage({ type: 'files', files: [], root: null });
      }
      return;
    }
    const { files, errorCount } = await listWorkspaceFiles(root);
    if (sessionId !== this._currentSessionId) {
      return;
    }
    this._view?.webview.postMessage({
      type: 'files',
      root,
      files: files.slice(0, 500).map(f => ({
        relPath: f.relPath,
        name: f.name,
        size: f.size,
        absPath: f.absPath,
      })),
      totalCount: files.length,
      truncated: files.length > 500,
      errorCount,
    });
  }

  private async _pushSearchResults(query: string): Promise<void> {
    const root = this._activeRoot();
    if (!root) return;
    const q = query.trim().toLowerCase();
    const sessionId = ++this._currentSessionId;
    if (q.length === 0) {
      await this._pushFiles(root, sessionId);
      return;
    }
    const { files } = await listWorkspaceFiles(root);
    if (sessionId !== this._currentSessionId) {
      return;
    }
    const matches: FileNode[] = files
      .filter(f => f.relPath.toLowerCase().includes(q))
      .slice(0, 100);
    this._view?.webview.postMessage({
      type: 'searchResults',
      query,
      matches: matches.map(f => ({
        relPath: f.relPath,
        name: f.name,
        size: f.size,
        absPath: f.absPath,
      })),
    });
  }

  private async _pushStats(root: string | undefined, sessionId: number): Promise<void> {
    if (!root) {
      if (sessionId === this._currentSessionId) {
        this._view?.webview.postMessage({
          type: 'stats',
          stats: { files: 0, initialized: false, dbSizeBytes: 0, totalSizeBytes: 0, root: null },
        });
      }
      return;
    }
    const stats = await getWorkspaceStats(root);
    if (sessionId !== this._currentSessionId) {
      return;
    }
    this._view?.webview.postMessage({ type: 'stats', stats: { ...stats, root } });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'media', 'graphView.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'media', 'graphView.css')
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
    <div class="toolbar">
      <input type="text" id="search" placeholder="Filter files by path..." />
      <button id="refresh" title="Refresh">$(refresh)</button>
    </div>
    <div class="empty-state" id="empty-state" hidden>
      <div class="empty-state-icon">⬡</div>
      <div class="empty-state-title">No workspace open</div>
      <div class="empty-state-hint">Open a folder to see files and stats here.</div>
    </div>
    <div class="content" id="content">
      <div class="panel files">
        <h3>Files <span class="count" id="files-count"></span></h3>
        <div id="file-tree" class="scroll"></div>
      </div>
      <div class="panel graph">
        <h3>Call Graph</h3>
        <div id="graph-container" class="scroll">
          <div class="onboarding" id="graph-onboarding">
            <div class="onboarding-icon">⬡</div>
            <div class="onboarding-title">Get started with CodeGraph</div>
            <ol class="onboarding-steps">
              <li>Click <b>Initialize</b> below to create <code>.codegraph/</code>.</li>
              <li>Click <b>Index Workspace</b> to build the symbol graph.</li>
              <li>Browse files on the left — click any to open in the editor.</li>
            </ol>
            <div class="onboarding-hint">Hover, Code Lens, and visual call graph unlock once the workspace is indexed (Phase&nbsp;2).</div>
          </div>
          <div class="placeholder" id="graph-placeholder" hidden>
            <p>Indexed. Visual call graph coming in Phase 2.</p>
            <p class="hint">For now, search files on the left or use the command palette.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="actions" id="actions" hidden>
      <button id="btn-initialize">$(add) Initialize</button>
      <button id="btn-index">$(play) Index Workspace</button>
    </div>
    <div class="stats">
      <span id="stats">Loading…</span>
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
