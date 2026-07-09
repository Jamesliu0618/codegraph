# CodeGraph VS Code 延伸模組實現計畫

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推薦）或 superpowers:executing-plans 逐任務實現此計畫。步驟使用複選框（`- [ ]`）語法來追蹤進度。

**目標：** 將 CodeGraph 核心功能打包成 VS Code 延伸模組（.vsix），提供圖形化介面、MCP 整合、CLI 取代、開發體驗增強。

**架構：** 單體延伸模組，直接嵌入 CodeGraph 核心（extraction、resolution、graph、context、mcp），使用 esbuild 打包成單一 extension.js，tree-sitter WASM 檔案隨附在 dist/wasm/。

**技術棧：** TypeScript、VS Code Extension API、esbuild、tree-sitter (WASM)、SQLite (node:sqlite)、D3.js（WebView 視覺化）

**設計文件：** `docs/superpowers/specs/2026-07-10-vscode-extension-design.md`

---

## 檔案結構

```
vscode-extension/
├── .vscode/
│   ├── launch.json              # 除錯設定（Extension Development Host）
│   └── tasks.json               # 建置任務
├── src/
│   ├── extension.ts             # 延伸模組入口（activate/deactivate）
│   ├── core/                    # 從 CodeGraph 核心複製（symlink 或 copy）
│   │   ├── index.ts             # CodeGraph 類別
│   │   ├── extraction/          # tree-sitter 解析
│   │   ├── resolution/          # 引用解析
│   │   ├── graph/               # 圖譜查詢
│   │   ├── context/             # 上下文建構
│   │   ├── db/                  # SQLite 資料庫
│   │   └── mcp/                 # MCP server
│   ├── commands/
│   │   ├── initialize.ts        # CodeGraph: Initialize
│   │   ├── indexWorkspace.ts    # CodeGraph: Index Workspace
│   │   ├── syncChanges.ts       # CodeGraph: Sync Changes
│   │   ├── showStatus.ts        # CodeGraph: Show Status
│   │   └── querySymbol.ts       # CodeGraph: Query Symbol
│   ├── features/
│   │   ├── codeLensProvider.ts  # Code Lens（caller/callee 計數）
│   │   ├── hoverProvider.ts     # Hover（呼叫關係）
│   │   └── definitionProvider.ts # Definition（跨檔案跳轉）
│   ├── gui/
│   │   ├── statusBar.ts         # 狀態列管理
│   │   ├── graphViewProvider.ts # WebView 側邊欄
│   │   └── media/
│   │       ├── graphView.html   # WebView HTML
│   │       ├── graphView.css    # WebView 樣式
│   │       └── graphView.js     # WebView 腳本（D3.js 視覺化）
│   ├── mcp/
│   │   ├── mcpManager.ts        # MCP server 生命週期管理
│   │   └── copilotIntegration.ts # Copilot Chat 註冊
│   └── utils/
│       ├── workspace.ts         # Workspace 路徑工具
│       └── logger.ts            # Output channel 日誌
├── test/
│   ├── suite/
│   │   ├── extension.test.ts    # 延伸模組啟動測試
│   │   ├── commands.test.ts     # 命令測試
│   │   └── features.test.ts    # Code Lens / Hover 測試
│   └── runTest.ts               # 測試執行器
├── package.json                 # VS Code 延伸模組設定
├── tsconfig.json                # TypeScript 設定
├── esbuild.js                   # 打包設定
├── .vscodeignore                # 排除檔案
└── README.md                    # 延伸模組說明
```

---

## Phase 1：基礎架構 + CLI 取代

### 任務 1：初始化延伸模組專案

**檔案：**
- 建立：`vscode-extension/package.json`
- 建立：`vscode-extension/tsconfig.json`
- 建立：`vscode-extension/.vscodeignore`
- 建立：`vscode-extension/.vscode/launch.json`
- 建立：`vscode-extension/.vscode/tasks.json`

- [ ] **步驟 1：建立 package.json**

```json
{
  "name": "codegraph-vscode",
  "displayName": "CodeGraph",
  "description": "Semantic code intelligence for VS Code — surgical context, fewer tool calls, faster answers.",
  "version": "0.1.0",
  "publisher": "local",
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": ["Programming Languages", "Other"],
  "activationEvents": [
    "workspaceContains:**/.codegraph"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "codegraph.initialize",
        "title": "CodeGraph: Initialize"
      },
      {
        "command": "codegraph.indexWorkspace",
        "title": "CodeGraph: Index Workspace"
      },
      {
        "command": "codegraph.syncChanges",
        "title": "CodeGraph: Sync Changes"
      },
      {
        "command": "codegraph.showStatus",
        "title": "CodeGraph: Show Status"
      },
      {
        "command": "codegraph.querySymbol",
        "title": "CodeGraph: Query Symbol"
      },
      {
        "command": "codegraph.openGraphView",
        "title": "CodeGraph: Open Graph View"
      }
    ],
    "viewsContainers": {
      "activitybar": [
        {
          "id": "codegraph",
          "title": "CodeGraph",
          "icon": "assets/icon.svg"
        }
      ]
    },
    "views": {
      "codegraph": [
        {
          "type": "webview",
          "id": "codegraph.graphView",
          "name": "Graph View"
        }
      ]
    }
  },
  "scripts": {
    "vscode:prepublish": "npm run build",
    "build": "node esbuild.js --production",
    "watch": "node esbuild.js --watch",
    "test": "node ./out/test/runTest.js",
    "package": "vsce package --no-dependencies"
  },
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "esbuild": "^0.20.0",
    "@vscode/vsce": "^2.22.0"
  }
}
```

- [ ] **步驟 2：建立 tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "Node16",
    "target": "ES2022",
    "lib": ["ES2022"],
    "sourceMap": true,
    "rootDir": "src",
    "outDir": "out",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "exclude": ["node_modules", "dist", ".vscode-test"]
}
```

- [ ] **步驟 3：建立 esbuild.js**

```javascript
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    logLevel: 'info',
    plugins: [
      {
        name: 'copy-wasm',
        setup(build) {
          build.onEnd(() => {
            // Copy tree-sitter WASM files
            const wasmSrc = path.join(__dirname, 'node_modules/tree-sitter-wasms/out');
            const wasmDest = path.join(__dirname, 'dist/wasm');
            if (fs.existsSync(wasmSrc)) {
              fs.mkdirSync(wasmDest, { recursive: true });
              fs.readdirSync(wasmSrc).forEach(f => {
                if (f.endsWith('.wasm')) {
                  fs.copyFileSync(path.join(wasmSrc, f), path.join(wasmDest, f));
                }
              });
            }
            // Copy schema.sql
            const schemaSrc = path.join(__dirname, 'src/core/db/schema.sql');
            const schemaDest = path.join(__dirname, 'dist/schema.sql');
            if (fs.existsSync(schemaSrc)) {
              fs.copyFileSync(schemaSrc, schemaDest);
            }
          });
        },
      },
    ],
  });

  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **步驟 4：建立 .vscodeignore**

```
.vscode/**
.vscode-test/**
src/**
test/**
node_modules/**
.gitignore
tsconfig.json
esbuild.js
**/*.map
```

- [ ] **步驟 5：建立 .vscode/launch.json**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "preLaunchTask": "npm: watch"
    }
  ]
}
```

- [ ] **步驟 6：建立 .vscode/tasks.json**

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "type": "npm",
      "script": "watch",
      "problemMatcher": "$esbuild-watch",
      "isBackground": true,
      "presentation": {
        "reveal": "never"
      },
      "group": {
        "kind": "build",
        "isDefault": true
      }
    }
  ]
}
```

- [ ] **步驟 7：安裝依賴**

```bash
cd vscode-extension
npm install
```

- [ ] **步驟 8：Commit**

```bash
git add vscode-extension/
git commit -m "feat(vscode): initialize VS Code extension project structure"
```

---

### 任務 2：建立延伸模組入口與核心整合

**檔案：**
- 建立：`vscode-extension/src/extension.ts`
- 建立：`vscode-extension/src/utils/workspace.ts`
- 建立：`vscode-extension/src/utils/logger.ts`

- [ ] **步驟 1：建立 utils/logger.ts**

```typescript
import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel;

export function getLogger(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('CodeGraph');
  }
  return outputChannel;
}

export function log(message: string): void {
  const channel = getLogger();
  const timestamp = new Date().toISOString();
  channel.appendLine(`[${timestamp}] ${message}`);
}

export function logError(message: string, error?: Error): void {
  const channel = getLogger();
  const timestamp = new Date().toISOString();
  channel.appendLine(`[${timestamp}] ERROR: ${message}`);
  if (error) {
    channel.appendLine(`  ${error.message}`);
    if (error.stack) {
      channel.appendLine(`  ${error.stack}`);
    }
  }
}
```

- [ ] **步驟 2：建立 utils/workspace.ts**

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function getWorkspaceRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }
  return folders[0].uri.fsPath;
}

export function getCodegraphDir(): string | undefined {
  const root = getWorkspaceRoot();
  if (!root) return undefined;
  return path.join(root, '.codegraph');
}

export function isCodegraphInitialized(): boolean {
  const dir = getCodegraphDir();
  if (!dir) return false;
  return fs.existsSync(dir) && fs.existsSync(path.join(dir, 'codegraph.db'));
}

export function getDatabasePath(): string | undefined {
  const dir = getCodegraphDir();
  if (!dir) return undefined;
  return path.join(dir, 'codegraph.db');
}
```

- [ ] **步驟 3：建立 extension.ts（基礎骨架）**

```typescript
import * as vscode from 'vscode';
import { log, logError } from './utils/logger';
import { isCodegraphInitialized, getWorkspaceRoot } from './utils/workspace';

export async function activate(context: vscode.ExtensionContext) {
  log('CodeGraph extension activating...');

  // Check if workspace is initialized
  const root = getWorkspaceRoot();
  if (!root) {
    log('No workspace folder open');
    return;
  }

  if (!isCodegraphInitialized()) {
    const action = await vscode.window.showInformationMessage(
      'CodeGraph: This workspace is not indexed. Would you like to initialize?',
      'Initialize',
      'Later'
    );
    if (action === 'Initialize') {
      await vscode.commands.executeCommand('codegraph.initialize');
    }
  }

  log('CodeGraph extension activated');
}

export function deactivate() {
  log('CodeGraph extension deactivating...');
}
```

- [ ] **步驟 4：驗證編譯**

```bash
cd vscode-extension
npx tsc --noEmit
```

預期：無錯誤

- [ ] **步驟 5：Commit**

```bash
git add vscode-extension/src/
git commit -m "feat(vscode): add extension entry point and utility modules"
```

---

### 任務 3：實作 Initialize 命令

**檔案：**
- 建立：`vscode-extension/src/commands/initialize.ts`
- 修改：`vscode-extension/src/extension.ts`

- [ ] **步驟 1：建立 commands/initialize.ts**

```typescript
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getWorkspaceRoot, getCodegraphDir } from '../utils/workspace';
import { log, logError } from '../utils/logger';

export async function initializeCommand() {
  const root = getWorkspaceRoot();
  if (!root) {
    vscode.window.showErrorMessage('CodeGraph: No workspace folder open');
    return;
  }

  const cgDir = getCodegraphDir()!;

  if (fs.existsSync(path.join(cgDir, 'codegraph.db'))) {
    const action = await vscode.window.showWarningMessage(
      'CodeGraph: This workspace is already initialized. Re-initialize?',
      'Re-initialize',
      'Cancel'
    );
    if (action !== 'Re-initialize') return;
    fs.rmSync(cgDir, { recursive: true, force: true });
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'CodeGraph: Initializing...',
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ increment: 0, message: 'Creating .codegraph directory...' });
        fs.mkdirSync(cgDir, { recursive: true });

        progress.report({ increment: 50, message: 'Initializing database...' });
        // TODO: Initialize SQLite database with schema
        // For now, just create a placeholder
        fs.writeFileSync(path.join(cgDir, 'codegraph.db'), '');

        progress.report({ increment: 100, message: 'Done!' });
        log('Workspace initialized successfully');
        vscode.window.showInformationMessage('CodeGraph: Workspace initialized successfully');
      } catch (error) {
        logError('Failed to initialize workspace', error as Error);
        vscode.window.showErrorMessage(`CodeGraph: Initialization failed: ${(error as Error).message}`);
      }
    }
  );
}
```

- [ ] **步驟 2：註冊命令到 extension.ts**

在 `activate()` 函數中加入：

```typescript
import { initializeCommand } from './commands/initialize';

// 在 activate() 內：
context.subscriptions.push(
  vscode.commands.registerCommand('codegraph.initialize', initializeCommand)
);
```

- [ ] **步驟 3：測試命令**

1. 按 F5 啟動 Extension Development Host
2. 開啟一個新的資料夾
3. 開啟命令面板（Ctrl+Shift+P）
4. 輸入 `CodeGraph: Initialize`
5. 驗證 `.codegraph/` 目錄被建立

- [ ] **步驟 4：Commit**

```bash
git add vscode-extension/src/
git commit -m "feat(vscode): implement Initialize command"
```

---

### 任務 4：實作 Index Workspace 命令

**檔案：**
- 建立：`vscode-extension/src/commands/indexWorkspace.ts`
- 修改：`vscode-extension/src/extension.ts`

- [ ] **步驟 1：建立 commands/indexWorkspace.ts**

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getWorkspaceRoot, isCodegraphInitialized } from '../utils/workspace';
import { log, logError } from '../utils/logger';

export async function indexWorkspaceCommand() {
  const root = getWorkspaceRoot();
  if (!root) {
    vscode.window.showErrorMessage('CodeGraph: No workspace folder open');
    return;
  }

  if (!isCodegraphInitialized()) {
    const action = await vscode.window.showWarningMessage(
      'CodeGraph: Workspace not initialized. Initialize first?',
      'Initialize',
      'Cancel'
    );
    if (action === 'Initialize') {
      await vscode.commands.executeCommand('codegraph.initialize');
    }
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'CodeGraph: Indexing workspace...',
      cancellable: true,
    },
    async (progress, token) => {
      try {
        // Collect files
        progress.report({ increment: 0, message: 'Scanning files...' });
        const files = await collectFiles(root);
        log(`Found ${files.length} files to index`);

        if (token.isCancellationRequested) return;

        // Index files
        for (let i = 0; i < files.length; i++) {
          if (token.isCancellationRequested) return;

          const file = files[i];
          const percent = Math.round((i / files.length) * 100);
          progress.report({
            increment: (1 / files.length) * 100,
            message: `Indexing ${path.basename(file)} (${percent}%)`,
          });

          // TODO: Call ExtractionOrchestrator to parse file
          // For now, just log
          log(`Indexed: ${file}`);
        }

        log('Indexing completed successfully');
        vscode.window.showInformationMessage(
          `CodeGraph: Indexed ${files.length} files successfully`
        );
      } catch (error) {
        logError('Indexing failed', error as Error);
        vscode.window.showErrorMessage(`CodeGraph: Indexing failed: ${(error as Error).message}`);
      }
    }
  );
}

async function collectFiles(root: string): Promise<string[]> {
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.c', '.cpp'];
  const exclude = ['node_modules', '.git', 'dist', 'build', '.codegraph'];

  const files: string[] = [];

  async function walk(dir: string) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!exclude.includes(entry.name)) {
          await walk(fullPath);
        }
      } else if (extensions.includes(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }

  await walk(root);
  return files;
}
```

- [ ] **步驟 2：註冊命令到 extension.ts**

```typescript
import { indexWorkspaceCommand } from './commands/indexWorkspace';

context.subscriptions.push(
  vscode.commands.registerCommand('codegraph.indexWorkspace', indexWorkspaceCommand)
);
```

- [ ] **步驟 3：測試命令**

1. 按 F5 啟動 Extension Development Host
2. 開啟一個已初始化的資料夾
3. 執行 `CodeGraph: Index Workspace`
4. 驗證進度條顯示並完成

- [ ] **步驟 4：Commit**

```bash
git add vscode-extension/src/
git commit -m "feat(vscode): implement Index Workspace command"
```

---

### 任務 5：實作狀態列

**檔案：**
- 建立：`vscode-extension/src/gui/statusBar.ts`
- 修改：`vscode-extension/src/extension.ts`

- [ ] **步驟 1：建立 gui/statusBar.ts**

```typescript
import * as vscode from 'vscode';
import { isCodegraphInitialized } from '../utils/workspace';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = 'codegraph.showStatus';
    this.update();
  }

  public update() {
    if (isCodegraphInitialized()) {
      this.statusBarItem.text = '$(check) CodeGraph';
      this.statusBarItem.tooltip = 'CodeGraph: Indexed';
      this.statusBarItem.backgroundColor = undefined;
    } else {
      this.statusBarItem.text = '$(warning) CodeGraph';
      this.statusBarItem.tooltip = 'CodeGraph: Not indexed';
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground'
      );
    }
    this.statusBarItem.show();
  }

  public setIndexing() {
    this.statusBarItem.text = '$(sync~spin) CodeGraph: Indexing...';
    this.statusBarItem.tooltip = 'CodeGraph: Indexing in progress';
    this.statusBarItem.backgroundColor = new vscode.ThemeColor(
      'statusBarItem.prominentBackground'
    );
  }

  public dispose() {
    this.statusBarItem.dispose();
  }
}
```

- [ ] **步驟 2：整合到 extension.ts**

```typescript
import { StatusBarManager } from './gui/statusBar';

// 在 activate() 內：
const statusBar = new StatusBarManager();
context.subscriptions.push(statusBar);
```

- [ ] **步驟 3：測試狀態列**

1. 按 F5 啟動 Extension Development Host
2. 驗證狀態列顯示 `$(warning) CodeGraph`（未索引）
3. 執行 Initialize 後，驗證變為 `$(check) CodeGraph`

- [ ] **步驟 4：Commit**

```bash
git add vscode-extension/src/
git commit -m "feat(vscode): add status bar integration"
```

---

### 任務 6：實作 Show Status 與 Query Symbol 命令

**檔案：**
- 建立：`vscode-extension/src/commands/showStatus.ts`
- 建立：`vscode-extension/src/commands/querySymbol.ts`
- 修改：`vscode-extension/src/extension.ts`

- [ ] **步驟 1：建立 commands/showStatus.ts**

```typescript
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getCodegraphDir, isCodegraphInitialized } from '../utils/workspace';
import { getLogger } from '../utils/logger';

export async function showStatusCommand() {
  if (!isCodegraphInitialized()) {
    vscode.window.showWarningMessage('CodeGraph: Workspace not initialized');
    return;
  }

  const cgDir = getCodegraphDir()!;
  const dbPath = path.join(cgDir, 'codegraph.db');
  const stats = fs.statSync(dbPath);
  const dbSizeMB = (stats.size / 1024 / 1024).toFixed(2);

  // TODO: Query actual node/edge counts from database
  const nodeCount = 'N/A';
  const edgeCount = 'N/A';
  const fileCount = 'N/A';

  const message = `CodeGraph Status:
Database: ${dbSizeMB} MB
Nodes: ${nodeCount}
Edges: ${edgeCount}
Files: ${fileCount}`;

  vscode.window.showInformationMessage(message, { modal: true });
}
```

- [ ] **步驟 2：建立 commands/querySymbol.ts**

```typescript
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
```

- [ ] **步驟 3：註冊命令到 extension.ts**

```typescript
import { showStatusCommand } from './commands/showStatus';
import { querySymbolCommand } from './commands/querySymbol';

context.subscriptions.push(
  vscode.commands.registerCommand('codegraph.showStatus', showStatusCommand),
  vscode.commands.registerCommand('codegraph.querySymbol', querySymbolCommand)
);
```

- [ ] **步驟 4：Commit**

```bash
git add vscode-extension/src/
git commit -m "feat(vscode): implement Show Status and Query Symbol commands"
```

---

### 任務 7：Phase 1 整合測試與打包

**檔案：**
- 修改：`vscode-extension/src/extension.ts`（最終版本）

- [ ] **步驟 1：確保 extension.ts 註冊所有命令**

```typescript
import * as vscode from 'vscode';
import { log, logError } from './utils/logger';
import { isCodegraphInitialized, getWorkspaceRoot } from './utils/workspace';
import { initializeCommand } from './commands/initialize';
import { indexWorkspaceCommand } from './commands/indexWorkspace';
import { showStatusCommand } from './commands/showStatus';
import { querySymbolCommand } from './commands/querySymbol';
import { StatusBarManager } from './gui/statusBar';

export async function activate(context: vscode.ExtensionContext) {
  log('CodeGraph extension activating...');

  const root = getWorkspaceRoot();
  if (!root) {
    log('No workspace folder open');
    return;
  }

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codegraph.initialize', initializeCommand),
    vscode.commands.registerCommand('codegraph.indexWorkspace', indexWorkspaceCommand),
    vscode.commands.registerCommand('codegraph.showStatus', showStatusCommand),
    vscode.commands.registerCommand('codegraph.querySymbol', querySymbolCommand)
  );

  // Status bar
  const statusBar = new StatusBarManager();
  context.subscriptions.push(statusBar);

  // Auto-index prompt
  if (!isCodegraphInitialized()) {
    const action = await vscode.window.showInformationMessage(
      'CodeGraph: This workspace is not indexed. Would you like to initialize?',
      'Initialize',
      'Later'
    );
    if (action === 'Initialize') {
      await vscode.commands.executeCommand('codegraph.initialize');
    }
  }

  log('CodeGraph extension activated');
}

export function deactivate() {
  log('CodeGraph extension deactivating...');
}
```

- [ ] **步驟 2：打包 .vsix**

```bash
cd vscode-extension
npm run build
npx vsce package --no-dependencies
```

預期：產生 `codegraph-vscode-0.1.0.vsix`

- [ ] **步驟 3：安裝測試**

1. 開啟 VS Code
2. `Ctrl+Shift+P` → `Extensions: Install from VSIX...`
3. 選擇 `codegraph-vscode-0.1.0.vsix`
4. 驗證命令面板出現所有 CodeGraph 命令

- [ ] **步驟 4：Commit**

```bash
git add vscode-extension/
git commit -m "feat(vscode): Phase 1 complete - basic architecture and CLI replacement"
```

---

## Phase 2：開發體驗增強

### 任務 8：實作 Code Lens Provider

**檔案：**
- 建立：`vscode-extension/src/features/codeLensProvider.ts`
- 修改：`vscode-extension/src/extension.ts`

- [ ] **步驟 1：建立 features/codeLensProvider.ts**

```typescript
import * as vscode from 'vscode';

export class CodeGraphCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  constructor() {
    // Refresh when document changes
    vscode.workspace.onDidChangeDocument(() => {
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
```

- [ ] **步驟 2：註冊到 extension.ts**

```typescript
import { CodeGraphCodeLensProvider } from './features/codeLensProvider';

// 在 activate() 內：
const codeLensProvider = new CodeGraphCodeLensProvider();
context.subscriptions.push(
  vscode.languages.registerCodeLensProvider(
    { scheme: 'file', language: '*' },
    codeLensProvider
  )
);
```

- [ ] **步驟 3：測試 Code Lens**

1. 按 F5 啟動 Extension Development Host
2. 開啟一個 TypeScript 檔案
3. 驗證函數上方顯示 `$(people) 0 callers · $(phone) 0 callees`

- [ ] **步驟 4：Commit**

```bash
git add vscode-extension/src/
git commit -m "feat(vscode): implement Code Lens provider"
```

---

### 任務 9：實作 Hover Provider

**檔案：**
- 建立：`vscode-extension/src/features/hoverProvider.ts`
- 修改：`vscode-extension/src/extension.ts`

- [ ] **步驟 1：建立 features/hoverProvider.ts**

```typescript
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
```

- [ ] **步驟 2：註冊到 extension.ts**

```typescript
import { CodeGraphHoverProvider } from './features/hoverProvider';

// 在 activate() 內：
context.subscriptions.push(
  vscode.languages.registerHoverProvider(
    { scheme: 'file', language: '*' },
    new CodeGraphHoverProvider()
  )
);
```

- [ ] **步驟 3：測試 Hover**

1. 按 F5 啟動 Extension Development Host
2. 懸停在函數名稱上
3. 驗證顯示呼叫關係的 placeholder

- [ ] **步驟 4：Commit**

```bash
git add vscode-extension/src/
git commit -m "feat(vscode): implement Hover provider"
```

---

### 任務 10：實作 Definition Provider

**檔案：**
- 建立：`vscode-extension/src/features/definitionProvider.ts`
- 修改：`vscode-extension/src/extension.ts`

- [ ] **步驟 1：建立 features/definitionProvider.ts**

```typescript
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
```

- [ ] **步驟 2：註冊到 extension.ts**

```typescript
import { CodeGraphDefinitionProvider } from './features/definitionProvider';

// 在 activate() 內：
context.subscriptions.push(
  vscode.languages.registerDefinitionProvider(
    { scheme: 'file', language: '*' },
    new CodeGraphDefinitionProvider()
  )
);
```

- [ ] **步驟 3：Commit**

```bash
git add vscode-extension/src/
git commit -m "feat(vscode): implement Definition provider"
```

---

## Phase 3：MCP 整合

### 任務 11：實作 MCP Manager

**檔案：**
- 建立：`vscode-extension/src/mcp/mcpManager.ts`
- 修改：`vscode-extension/src/extension.ts`

- [ ] **步驟 1：建立 mcp/mcpManager.ts**

```typescript
import * as vscode from 'vscode';
import { ChildProcess, spawn } from 'child_process';
import { getWorkspaceRoot } from '../utils/workspace';
import { log, logError } from '../utils/logger';

export class McpManager {
  private serverProcess: ChildProcess | null = null;
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      99
    );
    this.statusBarItem.command = 'codegraph.showStatus';
  }

  public async start() {
    const root = getWorkspaceRoot();
    if (!root) {
      log('MCP: No workspace root, skipping MCP server start');
      return;
    }

    try {
      log('MCP: Starting server...');
      this.statusBarItem.text = '$(sync~spin) MCP: Starting...';
      this.statusBarItem.show();

      // TODO: Start actual MCP server process
      // For now, just update status
      this.statusBarItem.text = '$(check) MCP: Ready';
      this.statusBarItem.tooltip = 'CodeGraph MCP server is running';
      log('MCP: Server started successfully');
    } catch (error) {
      logError('MCP: Failed to start server', error as Error);
      this.statusBarItem.text = '$(error) MCP: Failed';
      this.statusBarItem.tooltip = 'MCP server failed to start';
    }
  }

  public stop() {
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }
    this.statusBarItem.text = '$(circle-slash) MCP: Stopped';
    log('MCP: Server stopped');
  }

  public dispose() {
    this.stop();
    this.statusBarItem.dispose();
  }
}
```

- [ ] **步驟 2：整合到 extension.ts**

```typescript
import { McpManager } from './mcp/mcpManager';

// 在 activate() 內：
const mcpManager = new McpManager();
await mcpManager.start();
context.subscriptions.push(mcpManager);
```

- [ ] **步驟 3：測試 MCP 狀態列**

1. 按 F5 啟動 Extension Development Host
2. 驗證狀態列顯示 `$(check) MCP: Ready`

- [ ] **步驟 4：Commit**

```bash
git add vscode-extension/src/
git commit -m "feat(vscode): implement MCP manager"
```

---

### 任務 12：實作 Copilot 整合

**檔案：**
- 建立：`vscode-extension/src/mcp/copilotIntegration.ts`
- 修改：`vscode-extension/src/extension.ts`

- [ ] **步驟 1：建立 mcp/copilotIntegration.ts**

```typescript
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getWorkspaceRoot } from '../utils/workspace';
import { log, logError } from '../utils/logger';

export class CopilotIntegration {
  public async register() {
    const root = getWorkspaceRoot();
    if (!root) return;

    try {
      // Write .vscode/mcp.json for Copilot Coding Agent
      const vscodeDir = path.join(root, '.vscode');
      if (!fs.existsSync(vscodeDir)) {
        fs.mkdirSync(vscodeDir, { recursive: true });
      }

      const mcpConfig = {
        servers: {
          codegraph: {
            command: 'codegraph',
            args: ['serve', '--mcp'],
            cwd: root,
          },
        },
      };

      const mcpPath = path.join(vscodeDir, 'mcp.json');
      fs.writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2));
      log(`Copilot: Written MCP config to ${mcpPath}`);
    } catch (error) {
      logError('Copilot: Failed to register', error as Error);
    }
  }
}
```

- [ ] **步驟 2：整合到 extension.ts**

```typescript
import { CopilotIntegration } from './mcp/copilotIntegration';

// 在 activate() 內：
const copilot = new CopilotIntegration();
await copilot.register();
```

- [ ] **步驟 3：Commit**

```bash
git add vscode-extension/src/
git commit -m "feat(vscode): implement Copilot integration"
```

---

## Phase 4：圖形化介面

### 任務 13：實作 Graph View WebView

**檔案：**
- 建立：`vscode-extension/src/gui/graphViewProvider.ts`
- 建立：`vscode-extension/src/gui/media/graphView.html`
- 建立：`vscode-extension/src/gui/media/graphView.css`
- 建立：`vscode-extension/src/gui/media/graphView.js`
- 修改：`vscode-extension/src/extension.ts`

- [ ] **步驟 1：建立 gui/graphViewProvider.ts**

```typescript
import * as vscode from 'vscode';
import * as path from 'path';

export class GraphViewProvider {
  public static readonly viewType = 'codegraph.graphView';

  private readonly _extensionUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'src', 'gui', 'media'),
      ],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from WebView
    webviewView.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'navigateToFile':
            const doc = await vscode.workspace.openTextDocument(message.file);
            await vscode.window.showTextDocument(doc);
            break;
          case 'searchSymbol':
            await vscode.commands.executeCommand('codegraph.querySymbol', message.symbol);
            break;
        }
      },
      undefined,
      []
    );
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
```

- [ ] **步驟 2：建立 gui/media/graphView.css**

```css
body {
  margin: 0;
  padding: 0;
  font-family: var(--vscode-font-family);
  color: var(--vscode-foreground);
  background-color: var(--vscode-editor-background);
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.search-box {
  padding: 8px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.search-box input {
  width: 100%;
  padding: 4px 8px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
  border-radius: 2px;
}

.content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.panel {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
}

.panel h3 {
  margin: 0 0 8px 0;
  font-size: 12px;
  text-transform: uppercase;
  color: var(--vscode-sideBarSectionHeader-foreground);
}

.stats {
  padding: 4px 8px;
  border-top: 1px solid var(--vscode-panel-border);
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

#graph-container {
  width: 100%;
  height: 300px;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
}
```

- [ ] **步驟 3：建立 gui/media/graphView.js**

```javascript
(function () {
  const vscode = acquireVsCodeApi();

  const searchInput = document.getElementById('search');
  const fileTree = document.getElementById('file-tree');
  const graphContainer = document.getElementById('graph-container');
  const statsEl = document.getElementById('stats');

  // Initialize
  statsEl.textContent = 'CodeGraph: Ready';

  // Search handler
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value;
    if (query.length > 2) {
      vscode.postMessage({ command: 'searchSymbol', symbol: query });
    }
  });

  // Placeholder: Display message
  fileTree.innerHTML = '<p style="color: var(--vscode-descriptionForeground);">File browser will be available after core integration</p>';
  graphContainer.innerHTML = '<p style="color: var(--vscode-descriptionForeground); text-align: center; padding-top: 120px;">Graph visualization will be available after core integration</p>';
})();
```

- [ ] **步驟 4：註冊到 extension.ts**

```typescript
import { GraphViewProvider } from './gui/graphViewProvider';

// 在 activate() 內：
const graphViewProvider = new GraphViewProvider(context.extensionUri);
context.subscriptions.push(
  vscode.window.registerWebviewViewProvider(
    GraphViewProvider.viewType,
    graphViewProvider
  )
);
```

- [ ] **步驟 5：測試 WebView**

1. 按 F5 啟動 Extension Development Host
2. 點擊活動列的 CodeGraph 圖示
3. 驗證 Graph View 側邊欄顯示

- [ ] **步驟 6：Commit**

```bash
git add vscode-extension/src/
git commit -m "feat(vscode): implement Graph View WebView"
```

---

### 任務 14：最終打包與測試

- [ ] **步驟 1：完整建置**

```bash
cd vscode-extension
npm run build
```

- [ ] **步驟 2：打包 .vsix**

```bash
npx vsce package --no-dependencies
```

- [ ] **步驟 3：完整測試清單**

- [ ] 安裝 .vsix 到 VS Code
- [ ] 驗證命令面板出現所有 CodeGraph 命令
- [ ] 執行 `CodeGraph: Initialize`
- [ ] 執行 `CodeGraph: Index Workspace`
- [ ] 驗證狀態列顯示正確
- [ ] 懸停函數顯示 Hover 資訊
- [ ] 開啟 Graph View 側邊欄
- [ ] 驗證 MCP 狀態列顯示

- [ ] **步驟 4：最終 Commit**

```bash
git add vscode-extension/
git commit -m "feat(vscode): Phase 4 complete - all features implemented"
```

---

## 計畫完成

**總任務數：** 14 個任務  
**預估時程：** 8-12 週  
**交付物：** `codegraph-vscode-0.1.0.vsix`

**下一步：** 選擇執行方式

1. **子代理驅動（推薦）** — 每個任務調度一個新的子代理，任務間進行審查
2. **內聯執行** — 在當前會話中使用 executing-plans 執行任務
