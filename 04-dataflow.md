# 資料流程 (Data Flow)

## 流程一：新增資料
1. 使用者輸入（文字 / 連結 / 圖片）。
2. 應用層進行標準化處理：
   - type = text/link/image
   - content = 原始內容
   - metadata = JSON (如 link title, image path)
   - created_at = timestamp
3. 寫入 SQLite (Notes table)。

## 流程二：搜尋資料
1. 使用者在搜尋框輸入關鍵字。
2. 搜尋模組呼叫 SQLite FTS5。
3. SQLite 返回相關筆記，依照相關性排序。
4. 結果回傳前端，顯示於清單。

## 流程圖

```mermaid
flowchart TD
    A[輸入資料] --> B[應用層標準化]
    B --> C[SQLite Notes Table]

    D[搜尋 Query] --> E[搜尋模組]
    E --> C
    C --> E
    E --> F[搜尋結果 -> 前端]
