# CodeGraph Graph View A 實作計畫

**目標：** 完成以選取檔案為中心的互動式局部 call graph，並打包安裝 VS Code extension。

**架構：** `GraphViewProvider` 從 CodeGraph SQLite 查詢選取檔案的符號、caller/callee 與 impact radius；WebView 只接收有界資料並在瀏覽器端繪製 SVG。檔案搜尋與 FTS5 符號搜尋共用搜尋框，所有節點操作以 WebView message 回傳 extension host。

**技術棧：** VS Code WebView API、TypeScript、原生 SVG/DOM、CodeGraph `CodeGraph.openSync()`。

## 功能完成項

- 選取檔案顯示局部節點與 calls 邊。
- 搜尋檔案與 FTS5 符號，符號結果可跳轉並載入引用圖。
- 點擊節點顯示選取狀態並請求 impact radius 高亮。
- 雙擊節點或右鍵「Show references」載入該節點的 caller/callee。
- 右鍵複製符號與跳轉定義。
- 節點拖曳、縮放、重設佈局、清除高亮。
- build、package、VSIX 安裝與檢查。
