# 系統架構設計 (Architecture)

## 🎯 目標
本系統的核心訴求是：
1. **簡單輸入**：使用者能快速丟資料（文字、連結、圖片），不需繁瑣標籤分類。
2. **快速搜尋**：透過本地全文檢索，毫秒級找到需要的資訊。
3. **穩定可靠**：即使離線也能存取，避免依賴雲端。

---

## 🏗️ 系統分層

### 1. 前端 (Frontend)
- 平台：行動 App（iOS / Android）為主，未來可延伸桌面版。
- 功能：
  - 輸入框（支援文字、連結、圖片）
  - 清單 / 時間軸檢視
  - 即時搜尋框

### 2. 應用層 (Application Layer)
- 資料處理：
  - 將輸入標準化（文字、標題、metadata）。
- 搜尋模組：
  - 提供 `query -> 結果` API。
  - 即時回應搜尋請求。

### 3. 資料庫 (Local Database)
- 使用 SQLite，並啟用 FTS5 (Full Text Search) 模組。
- 資料表設計 (初版)：
  ```sql
  CREATE TABLE Notes (
    id INTEGER PRIMARY KEY,
    type TEXT,            -- text / link / image
    content TEXT,         -- 原始內容
    metadata JSON,        -- 額外資訊 (如標題、圖片路徑)
    created_at TIMESTAMP  -- 建立時間
  );
