🧠 一、概念核心

「每一次貼網址或筆記，AI 就幫你長出一個心智節點，並自動連線到相關概念。」

🧩 二、架構總覽（System Architecture）
graph TD
    subgraph User
        A1[貼上網址 / 新增筆記]
        A2[查看心智圖]
    end

    subgraph Electron App
        B1[Renderer (React UI)]
        B2[Main Process (IPC 控制)]
        B3[SQLite Database]
    end

    subgraph AI Engine
        C1[OpenAI API (GPT-4o-mini)]
        C2[Embedding Engine (text-embedding-3-small)]
    end

    subgraph Visualization Layer
        D1[Graph Engine (vis-network.js / react-force-graph)]
        D2[Node Interaction (點擊/拖曳/延伸)]
    end

    A1 -->|content| B1
    B1 -->|IPC 呼叫| B2
    B2 -->|儲存 & 呼叫 AI 摘要| C1
    B2 -->|向量生成| C2
    C1 -->|摘要 + 主題 + 標籤| B3
    C2 -->|Embedding 向量| B3
    B3 -->|相似度比對| B2
    B2 -->|傳回心智圖資料 (nodes + edges)| B1
    B1 --> D1
    D1 --> D2
    D2 -->|互動結果回傳| B1

🧩 三、資料流解釋（Data Flow）
流程	動作	輸入	輸出
1. 貼上網址	使用者輸入連結	URL	content, type=url
2. 擷取內容	fetch + GPT 摘要	HTML	summary, tags, topic
3. 生成向量	使用 text-embedding-3-small	summary	embedding (1536 維)
4. 儲存資料	SQLite + Vector Table	note + embedding	note_id, embedding_id
5. 找相似節點	cosine similarity	新 note embedding	related_note_ids
6. 心智圖更新	React UI + Graph Engine	notes, relations	Interactive Map
7. 使用者互動	點擊節點、AI 延伸	node_id	新筆記 or 洞察
🧩 四、資料表設計（SQLite Schema）
CREATE TABLE notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT,
  summary TEXT,
  tags TEXT,
  topic TEXT,
  url TEXT,
  type TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE embeddings (
  note_id INTEGER,
  vector BLOB,  -- 存放 float32 向量
  FOREIGN KEY(note_id) REFERENCES notes(id)
);

CREATE TABLE relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id INTEGER,
  to_id INTEGER,
  type TEXT,     -- related / cause / subtopic
  weight REAL
);

🎨 五、UI 構想（User Flow）
graph LR
    U1[使用者貼網址] --> S1[顯示 Loading Card]
    S1 --> A1[AI 摘要生成中...]
    A1 --> S2[顯示摘要卡 + 標籤 + 主題]
    S2 --> G1[加入心智圖節點]
    G1 --> G2[AI 比對相似節點 → 建立連線]
    G2 --> G3[心智圖自動更新]
    G3 --> U2[使用者可拖曳 / 點擊查看 / AI 延伸筆記]

🧩 六、AI Prompt 設計（三層提示）
模式	Prompt 功能	用途
摘要 Prompt	壓縮內容成「主題 + 三點摘要」	顯示在筆記卡上
分類 Prompt	分析屬於哪種類別（新聞/技術/學術）	topic 欄位
關聯 Prompt	對比新筆記與舊筆記主題相似性	建立 edges
🌱 七、產品未來延伸方向
模組	說明
🪄 AI 延伸子節點	使用者可點節點 → GPT 生成延伸想法
🔍 全文 + 語意搜尋	用 embedding 快速找相關筆記
📊 心智圖分群模式	根據語意自動群集（Cluster by topic）
🧭 導覽模式	點擊主題 → 顯示相關節點動態動畫
🧩 多人協作	支援雲端同步與共同知識地圖
✨ 八、整體願景（一句話）

讓筆記變成會自己長出分枝的知識森林。

你只需貼網址、寫想法，AI 幫你構築一張能思考的心智圖。
