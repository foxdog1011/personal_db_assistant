// types/Note.ts
export interface Note {
  id: number;

  /** 筆記內容（純文字或網址） */
  content: string;

  /** 標籤（以逗號分隔） */
  tags?: string;

  /** 顏色 HEX */
  color?: string;

  /** 是否釘選 */
  pinned?: number;

  /** 筆記類型：text, url, idea, code, voice... */
  type?: string;

  /** 建立時間 */
  created_at?: string;

  /** 舊版 AI 摘要（若仍保留 generateSummary 功能） */
  summary?: string;

  /** 新版 AI Insight（JSON 字串，包含 summary / expansion / connections） */
  insight?: string | null;

  /** 可選：三元關係（若你想前端可視覺化用） */
  triplesCount?: number;

  /** 未來可擴充欄位：嵌入向量、關聯節點等 */
  embedding?: string | null;
}
