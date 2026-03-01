🧩 一、整體模組依賴圖（Module Dependency Diagram）
graph TD
    %% === Main Layers ===
    subgraph Electron Main Process
        M1[electron/main.ts]
        M2[db/manager.ts]
        M3[services/ai_service.ts]
        M4[services/embedding_service.ts]
        M5[services/relation_service.ts]
    end

    subgraph Frontend Renderer (React + Vite)
        R1[src/App.tsx]
        R2[src/components/NoteList.tsx]
        R3[src/components/NoteCard.tsx]
        R4[src/components/GraphView.tsx]
        R5[src/hooks/useGraphData.ts]
        R6[src/services/ipcClient.ts]
    end

    subgraph Database
        D1[SQLite: notes]
        D2[SQLite: embeddings]
        D3[SQLite: relations]
    end

    subgraph External API
        A1[OpenAI GPT-4o-mini]
        A2[OpenAI Embeddings API]
    end

    %% === Connections ===
    R1 --> R2
    R2 --> R3
    R1 --> R4
    R4 --> R5
    R5 --> R6
    R6 --> M1
    M1 --> M2
    M1 --> M3
    M1 --> M4
    M1 --> M5

    M3 --> A1
    M4 --> A2
    M2 --> D1
    M4 --> D2
    M5 --> D3

⚙️ 二、模組說明與職責
模組	功能描述	關鍵職責
electron/main.ts	主進程入口，處理所有 IPC 事件	負責調度 AI 摘要、DB 操作與圖譜更新
db/manager.ts	SQLite 資料存取層	CRUD 筆記、向量、關聯資料表
services/ai_service.ts	GPT 摘要與主題分類	摘要筆記、產生 tags/topic、回傳 JSON 結構
services/embedding_service.ts	產生與比對語意向量	使用 Embeddings API 建立 1536 維向量並儲存
services/relation_service.ts	自動建立筆記關聯線	根據相似度 threshold 產生 graph edges
src/App.tsx	React 主容器	控制筆記清單與圖譜視圖切換
src/components/NoteList.tsx	筆記列表 UI	顯示所有筆記與搜尋欄
src/components/NoteCard.tsx	單一筆記卡 UI	顯示摘要、標籤與 AI 洞察
src/components/GraphView.tsx	心智圖可視化	渲染節點與邊、支援互動拖曳與點擊
src/hooks/useGraphData.ts	前端資料 Hook	從 IPC 取得筆記與關聯資料，轉換成 vis-network 格式
src/services/ipcClient.ts	封裝 IPC 呼叫	提供前端與 Electron 溝通的 API 介面
🧠 三、資料流（Data Flow Example）

使用者貼上網址 → 自動產生摘要 → 更新心智圖

sequenceDiagram
    participant User
    participant Renderer
    participant IPCClient
    participant ElectronMain
    participant AISvc
    participant EmbSvc
    participant DBSvc
    participant GraphSvc

    User->>Renderer: 貼上網址
    Renderer->>IPCClient: ipc.invoke("add-note", { content })
    IPCClient->>ElectronMain: IPC 呼叫
    ElectronMain->>AISvc: 呼叫 GPT 生成摘要 + 主題 + 標籤
    ElectronMain->>EmbSvc: 產生向量並儲存
    ElectronMain->>DBSvc: insertNote()
    ElectronMain->>GraphSvc: 建立關聯關係
    ElectronMain-->>IPCClient: 回傳筆記 + 關聯資料
    IPCClient-->>Renderer: 更新心智圖節點

🧩 四、範例檔案內容預覽
📘 services/ai_service.ts
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function summarize(content: string) {
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "請摘要以下內容並提取主題與三個關鍵標籤。" },
      { role: "user", content }
    ],
  });
  const output = res.choices[0].message?.content || "";
  const [summary, tags] = output.split("標籤:");
  return { summary: summary.trim(), tags: tags?.split(",") || [] };
}

📘 services/embedding_service.ts
import OpenAI from "openai";
import { saveEmbedding, getAllEmbeddings } from "../db/manager";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function createEmbedding(noteId: number, text: string) {
  const res = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  await saveEmbedding(noteId, res.data[0].embedding);
}

export async function findSimilarNotes(vector: number[], threshold = 0.8) {
  const all = await getAllEmbeddings();
  // cosine similarity 計算
  return all
    .map((e) => ({ id: e.note_id, score: cosine(vector, e.vector) }))
    .filter((x) => x.score > threshold);
}

🎨 五、UI 前端結構概念
src/
 ├─ components/
 │   ├─ NoteList.tsx
 │   ├─ NoteCard.tsx
 │   ├─ GraphView.tsx
 │
 ├─ hooks/
 │   └─ useGraphData.ts
 │
 ├─ services/
 │   └─ ipcClient.ts
 │
 ├─ App.tsx
 └─ main.tsx

🚀 六、未來可擴充模組
模組	說明
background_worker.ts	處理多筆 AI 摘要任務（非同步 queue）
sync_service.ts	未來可支援雲端同步 (e.g. Supabase / Firestore)
visual_theme.ts	自訂節點顏色、佈局樣式
ai_prompt_presets.ts	定義不同摘要風格（新聞、技術、學習）
✨ 七、最終願景一句話

讓筆記長成心智圖，讓心智圖成為你的第二大腦。
每一次新增筆記、連結、或延伸思考，AI 就幫你更新整張知識網絡。