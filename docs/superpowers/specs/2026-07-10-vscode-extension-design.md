# CodeGraph VS Code 延伸模組設計文件

**日期**：2026-07-10  
**版本**：1.0.0  
**狀態**：設計完成，待實作

---

## 📋 專案概述

### 目標

將 CodeGraph（`@colbymchenry/codegraph`）開發成 VS Code 延伸模組（.vsix），提供完整的程式碼智慧體驗，包含：

1. **圖形化介面** — 視覺化知識圖譜瀏覽
2. **MCP 整合** — 自動連接 VS Code 內的 AI agents
3. **CLI 取代** — 在 VS Code 內完成所有操作
4. **開發體驗增強** — Code Lens、Hover、Definition 等即時反饋

### 技術決策

- **架構**：單體延伸模組（直接嵌入核心）
- **發布方式**：僅本地/私有發布（.vsix 檔案）
- **依賴策略**：零外部依賴，所有功能內建
- **資料儲存**：Workspace-scoped `.codegraph/` 目錄

### 成功標準

- ✅ 不需要安裝 CLI 即可使用所有功能
- ✅ 開啟資料夾後自動提示索引
- ✅ 即時反饋（Code Lens、Hover）延遲 <3 秒
- ✅ MCP server 自動啟動，AI agents 可直接使用
- ✅ 視覺化介面可以互動瀏覽知識圖譜

---

## 🏗️ 架構設計

### 目錄結構

```
codegraph-vscode/
├── .vscode/                    # VS Code 設定
│   ├── launch.json            # 除錯設定
│   └── tasks.json             # 建置任務
├── src/
│   ├── extension.ts           # 延伸模組入口（activate/deactivate）
│   ├── core/                  # 從 CodeGraph 核心複製
│   │   ├── extraction/        # tree-sitter 解析
│   │   ├── resolution/        # 引用解析
│   │   ├── graph/             # 圖譜查詢
│   │   ├── context/           # 上下文建構
│   │   ├── db/                # SQLite 資料庫
│   │   └── mcp/               # MCP server 實作
│   ├── gui/                   # VS Code GUI 元件
│   │   ├── graphView.ts       # 知識圖譜視覺化（WebView）
│   │   ├── statusBar.ts       # 狀態列（顯示索引狀態）
│   │   └── commands.ts        # 命令面板整合
│   ├── features/              # 開發體驗增強
│   │   ├── codeLens.ts        # 顯示函數被引用次數
│   │   ├── hoverProvider.ts   # Hover 顯示呼叫關係
│   │   └── definitionProvider.ts  # 跳轉到定義
│   └── utils/                 # 工具函數
├── dist/                      # 編譯輸出
│   ├── extension.js           # 打包後的延伸模組
│   └── wasm/                  # tree-sitter WASM 檔案
├── package.json               # VS Code 延伸模組設定
├── tsconfig.json              # TypeScript 設定
├── esbuild.js                 # 打包設定
└── README.md
```

### 核心設計原則

1. **零外部依賴** — 所有功能內建，不需要安裝 CLI
2. **Workspace-scoped** — 每個 VS Code workspace 有獨立的 `.codegraph/` 目錄
3. **自動索引** — 開啟資料夾時自動檢查並提示索引
4. **即時回饋** — 使用 Code Lens、Hover、Definition 提供即時資訊
5. **漸進式增強** — 分階段交付，每個階段都可以獨立使用

---

## 🎯 功能規格

### 1. 圖形化介面（Graph View）

**實作方式**：使用 VS Code WebView API 建立獨立的側邊欄面板

**功能清單**：

- **符號瀏覽器** — 樹狀顯示所有 classes、functions、methods
- **呼叫鏈視覺化** — 點擊函數顯示 caller/callee 關係圖（使用 D3.js 或 Cytoscape.js）
- **影響範圍分析** — 選擇節點後高亮顯示所有受影響的檔案
- **搜尋** — FTS5 全文搜尋整合到 WebView 的搜尋框

**UI 佈局**：

```
┌─────────────────────────────────┐
│  🔍 Search symbols...           │
├─────────────────────────────────┤
│  📁 Files          │ 🕸 Graph   │
│  ├─ src/           │            │
│  │  ├─ index.ts    │   [Node]   │
│  │  └─ utils.ts    │    ↕       │
│  └─ tests/         │   [Node]   │
├─────────────────────────────────┤
│  📊 Stats: 147 files, 2.3k nodes│
└─────────────────────────────────┘
```

**互動功能**：

- 點擊節點 → 跳轉到對應的程式碼位置
- 雙擊節點 → 展開/收合子節點
- 右鍵選單 → 複製符號名稱、查看定義、尋找引用
- 拖曳 → 重新排列節點位置
- 縮放 → 調整視覺化大小

---

### 2. MCP 整合

**實作方式**：延伸模組啟動時自動啟動 MCP server，並註冊到 VS Code 的 AI 工具生態

**流程**：

1. 延伸模組 `activate()` 時，檢查 workspace 是否有 `.codegraph/`
2. 如果沒有，提示使用者執行 `CodeGraph: Initialize`
3. 如果有，啟動 MCP server（使用 `src/mcp/server.ts`）
4. 將 MCP server 的 endpoint 註冊到：
   - VS Code 的 `languageModelTools` API（Copilot Chat）
   - `.vscode/mcp.json`（Copilot Coding Agent）

**自動連接的 AI 工具**：

- ✅ GitHub Copilot Chat（透過 `vscode.languageModel` API）
- ✅ Copilot Coding Agent（透過 `.vscode/mcp.json`）
- ✅ 其他支援 MCP 的延伸模組

**MCP 狀態指示**：

```
┌──────────────────────────────────────────┐
│  🟢 MCP: Connected (6 tools)            │
└──────────────────────────────────────────┘
```

- 🟢 綠色：已連線，顯示可用工具數量
- 🟡 黃色：連線中
- 🔴 紅色：連線失敗

---

### 3. CLI 取代（命令面板整合）

**實作方式**：將所有 CLI 子命令轉換為 VS Code 命令

| CLI 命令 | VS Code 命令 | 功能 |
|----------|--------------|------|
| `codegraph init` | `CodeGraph: Initialize` | 初始化 `.codegraph/` |
| `codegraph index` | `CodeGraph: Index Workspace` | 索引整個 workspace |
| `codegraph sync` | `CodeGraph: Sync Changes` | 同步檔案變更 |
| `codegraph status` | `CodeGraph: Show Status` | 顯示索引狀態 |
| `codegraph query` | `CodeGraph: Query Symbol` | 快速搜尋符號 |
| `codegraph serve --mcp` | 自動啟動 | 背景 MCP server |

**狀態列整合**：

```
┌──────────────────────────────────────────┐
│  🟢 CodeGraph: 147 files indexed  │ ⟳ │
└──────────────────────────────────────────┘
```

- 🟢 綠色：索引完成
- 🟡 黃色：索引中
- 🔴 紅色：未索引

**進度通知**：

- 索引開始 → 顯示進度條
- 索引完成 → 顯示完成通知（可關閉）
- 索引失敗 → 顯示錯誤通知（需要重新索引）

---

### 4. 開發體驗增強

#### Code Lens

**顯示位置**：函數、方法、類別定義上方

**內容**：

```typescript
// 👥 3 callers · 📞 5 callees
function calculateTotal(items: Item[]): number {
  // ...
}
```

**互動**：

- 點擊 `3 callers` → 顯示所有呼叫者的列表
- 點擊 `5 callees` → 顯示所有被呼叫者的列表

#### Hover Provider

**觸發方式**：滑鼠懸停在函數名稱上

**內容**：

```typescript
function calculateTotal(items: Item[]): number {
// ─────────────────────────────────────
// 📞 Called by: processOrder, checkout
// 👥 Calls: applyDiscount, calculateTax
// 📁 Impact: 3 files
// ─────────────────────────────────────
```

**格式**：

- 使用 Markdown 格式化
- 包含語法高亮
- 可以點擊連結跳轉

#### Definition Provider

**觸發方式**：`Ctrl+Click`（Windows/Linux）或 `Cmd+Click`（macOS）

**功能**：

- 跳轉到函數定義（跨檔案）
- 支援動態調用（callback、event emitter）的跳轉
- 如果有多個定義，顯示選擇列表

---

## 🔄 資料流

### 從檔案變更到圖譜更新

```
使用者儲存檔案
    ↓
VS Code 觸發 onDidSaveTextDocument
    ↓
FileWatcher 偵測變更（debounce 500ms）
    ↓
ExtractionOrchestrator 解析檔案
    ↓
更新 SQLite（nodes/edges/files）
    ↓
ReferenceResolver 解析引用
    ↓
觸發 Code Lens / Hover 重新計算
    ↓
更新狀態列顯示
```

### 自動同步策略

- ✅ 儲存檔案時自動同步（debounce 500ms）
- ✅ 批量操作（如 git checkout）時暫停同步，完成後一次性更新
- ✅ 大型變更（>100 檔案）顯示進度條

---

## ⚠️ 錯誤處理

### 錯誤情境與處理方式

| 情境 | 處理方式 |
|------|----------|
| **tree-sitter WASM 載入失敗** | 顯示錯誤通知，提供重新下載選項 |
| **SQLite 資料庫損壞** | 自動備份 `.codegraph/` 並提示重新索引 |
| **記憶體不足（大型專案）** | 限制索引檔案數量，提示排除 `node_modules` |
| **MCP server 啟動失敗** | 記錄日誌到 Output channel，不影響其他功能 |
| **語法解析錯誤** | 跳過該檔案，在狀態列顯示警告計數 |

### 錯誤通知原則

- 🔴 **嚴重錯誤**（資料庫損壞）：彈出通知，需要使用者介入
- 🟡 **警告**（語法錯誤）：狀態列顯示計數，不中斷工作
- 🔵 **資訊**（索引完成）：Output channel 記錄，不彈出通知

---

## ⚡ 效能考量

### 記憶體管理

- tree-sitter parser 使用後立即釋放
- SQLite 查詢使用 prepared statements
- WebView 使用 virtual scrolling（>1000 節點時）

### 索引效能

- 使用 Web Workers 避免阻塞 UI thread
- 增量索引：只處理變更的檔案
- 並行解析：最多 4 個 worker（可配置）

### 預估效能

| 專案規模 | 檔案數 | 首次索引時間 | 增量更新時間 |
|---------|--------|-------------|-------------|
| 小型 | <500 | 5-10 秒 | <1 秒 |
| 中型 | 500-2000 | 20-40 秒 | 1-3 秒 |
| 大型 | >2000 | 1-3 分鐘 | 3-10 秒 |

---

## 🧪 測試策略

### 單元測試

- 使用 `vitest` 測試核心功能（extraction、resolution）
- 測試 VS Code API mock（Code Lens、Hover）

### 整合測試

- 使用 `@vscode/test-electron` 在真實 VS Code 環境測試
- 測試命令執行、WebView 互動

### 手動測試清單

- [ ] 開啟未索引的資料夾，驗證提示訊息
- [ ] 執行 `CodeGraph: Index Workspace`，驗證進度顯示
- [ ] 儲存檔案，驗證自動同步
- [ ] 點擊 Code Lens，驗證跳轉到定義
- [ ] 懸停函數，驗證顯示呼叫關係
- [ ] 開啟 Graph View，驗證視覺化正確

---

## 📅 分階段交付計畫

### Phase 1：基礎架構 + CLI 取代（2-3 週）

**目標**：建立延伸模組骨架，讓使用者可以在 VS Code 內完成所有 CLI 操作

**交付內容**：

- ✅ 延伸模組專案結構（`vscode-extension/`）
- ✅ 打包設定（esbuild + WASM 檔案複製）
- ✅ 命令面板整合（init、index、sync、status）
- ✅ 狀態列顯示（索引狀態、檔案計數）
- ✅ 自動索引提示（開啟資料夾時檢查 `.codegraph/`）
- ✅ 基本錯誤處理（通知、Output channel）

**驗收標準**：

- 可以安裝 .vsix 並在 VS Code 內執行 `CodeGraph: Initialize`
- 狀態列正確顯示索引狀態
- 不需要終端機即可完成基本操作

---

### Phase 2：開發體驗增強（2-3 週）

**目標**：在編輯器內提供即時的程式碼智慧反饋

**交付內容**：

- ✅ Code Lens Provider（顯示 caller/callee 計數）
- ✅ Hover Provider（顯示呼叫關係、影響範圍）
- ✅ Definition Provider（跨檔案跳轉）
- ✅ 自動同步（檔案儲存時更新圖譜）
- ✅ 效能優化（Web Workers、增量索引）

**驗收標準**：

- 函數上方顯示正確的 caller/callee 計數
- Hover 顯示完整的呼叫關係
- `Ctrl+Click` 可以跳轉到定義
- 儲存檔案後 <3 秒內更新完成

---

### Phase 3：MCP 整合（1-2 週）

**目標**：讓 VS Code 內的 AI agents 自動使用 CodeGraph

**交付內容**：

- ✅ 背景 MCP server 管理（自動啟動/停止）
- ✅ 註冊到 GitHub Copilot Chat（`vscode.languageModel` API）
- ✅ 寫入 `.vscode/mcp.json`（Copilot Coding Agent）
- ✅ MCP 狀態指示（連線狀態、工具計數）

**驗收標準**：

- 開啟 VS Code 後 MCP server 自動啟動
- Copilot Chat 可以使用 `codegraph_explore` 等工具
- 不需要手動執行 `codegraph install`

---

### Phase 4：圖形化介面（3-4 週）

**目標**：提供視覺化的知識圖譜瀏覽體驗

**交付內容**：

- ✅ WebView 側邊欄（符號瀏覽器）
- ✅ 呼叫鏈視覺化（D3.js 或 Cytoscape.js）
- ✅ 影響範圍分析（高亮顯示受影響的檔案）
- ✅ 全文搜尋整合（FTS5 → WebView）
- ✅ 互動功能（點擊節點跳轉到程式碼）

**驗收標準**：

- 可以瀏覽所有符號的樹狀結構
- 點擊函數顯示 caller/callee 關係圖
- 搜尋結果 <500ms 內顯示
- 視覺化圖譜可以互動（縮放、拖曳）

---

### 總時程預估

| 階段 | 時程 | 累計 |
|------|------|------|
| Phase 1 | 2-3 週 | 2-3 週 |
| Phase 2 | 2-3 週 | 4-6 週 |
| Phase 3 | 1-2 週 | 5-8 週 |
| Phase 4 | 3-4 週 | 8-12 週 |

**總計**：約 2-3 個月完成所有功能

---

## 🔄 每個階段的交付流程

1. **開發** — 在 `vscode-extension/` 目錄實作功能
2. **測試** — 使用 `@vscode/test-electron` 執行整合測試
3. **打包** — 執行 `vsce package` 產生 .vsix 檔案
4. **安裝** — 在 VS Code 內 `Install from VSIX...` 安裝測試
5. **迭代** — 根據使用回饋調整

---

## 📚 參考資源

- [VS Code 延伸模組文件](https://code.visualstudio.com/api)
- [VS Code WebView API](https://code.visualstudio.com/api/extension-guides/webview)
- [VS Code Code Lens Provider](https://code.visualstudio.com/api/references/vscode-api#CodeLensProvider)
- [VS Code Hover Provider](https://code.visualstudio.com/api/references/vscode-api#HoverProvider)
- [MCP 協議規格](https://modelcontextprotocol.io/)
- [tree-sitter 文件](https://tree-sitter.github.io/tree-sitter/)

---

## 📝 變更日誌

- **2026-07-10**：初始設計文件，完成所有功能規格與分階段交付計畫
