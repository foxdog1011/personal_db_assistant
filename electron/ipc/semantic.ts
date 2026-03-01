import { ipcMain } from "electron";
import type sqlite3 from "sqlite3";
import type OpenAI from "openai";
import { getRelatedNotes } from "../services/related_notes";
import { getSemanticNotes } from "../services/semantic_notes";

/** IPC Context 統一型別 */
export interface IpcContext {
  db: sqlite3.Database;
  openai?: OpenAI;
}

/** 🧩 防止重複註冊 */
let SEMANTIC_IPC_REGISTERED = false;

/** ✅ 主函式：註冊 Semantic IPC */
export function registerSemanticIpc(ctx: IpcContext) {
  // 🛡️ 如果已經註冊過，直接跳過
  if (SEMANTIC_IPC_REGISTERED) {
    console.warn("[SEM] ⚠️ Semantic IPC 已註冊，跳過重複呼叫");
    return;
  }
  SEMANTIC_IPC_REGISTERED = true;

  const { db, openai } = ctx;
  if (!db) throw new Error("[SEM] Missing db instance");

  // 🧹 保險：移除舊的 handler（避免熱重載時舊的還沒釋放）
  const handlers = ["get-related-notes", "get-semantic-notes", "generate-ai-relations", "ai-query"];
  for (const h of handlers) {
    if (ipcMain.eventNames().includes(h)) {
      console.warn(`[SEM] ⚠️ Handler '${h}' 已存在，將移除後重新註冊`);
      ipcMain.removeHandler(h);
    }
  }

  /* =====================================================
   * 1️⃣ 相關筆記推薦（concept-graph based）
   * ===================================================== */
  ipcMain.handle(
    "get-related-notes",
    async (_event, args: { noteId: string; k?: number }) => {
      const { noteId, k } = args ?? {};
      try {
        const related = await getRelatedNotes(db, { noteId: String(noteId), k });
        console.log(`[RECOMMEND] noteId=${noteId} returned=${related.length}`);
        return { related };
      } catch (err) {
        console.error("[RECOMMEND] ❌ error:", err);
        return { related: [] };
      }
    }
  );

  /* =====================================================
   * 2️⃣ 語意相似推薦（embedding cosine / overlap fallback）
   * ===================================================== */
  ipcMain.handle(
    "get-semantic-notes",
    async (_event, args: { noteId: string; k?: number }) => {
      const { noteId, k } = args ?? {};
      try {
        return await getSemanticNotes(db, { noteId: String(noteId), k });
      } catch (err) {
        console.error("[SEMANTIC] ❌ error:", err);
        return { related: [] };
      }
    }
  );

  /* =====================================================
   * 4️⃣ 生成 AI 延伸標籤
   * ===================================================== */
  ipcMain.handle("generate-ai-relations", async (_event, { content }) => {
    if (!openai) return { suggestions: "AI 未初始化" };
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "你是一個知識分類助理，請根據輸入內容給出 3~5 個中文主題標籤，用頓號分隔。",
          },
          { role: "user", content },
        ],
      });
      const suggestions =
        completion.choices[0].message?.content?.trim() || "無法產生標籤";
      return { suggestions };
    } catch (err) {
      console.error("[SEM] ❌ generate-ai-relations 失敗", err);
      return { suggestions: "AI 錯誤" };
    }
  });

  /* =====================================================
   * 5️⃣ AI Query 語義說明
   * ===================================================== */
  ipcMain.handle("ai-query", async (_event, { prompt }) => {
    if (!openai) return "AI 未初始化";
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "你是一位語意解釋專家，請用中文簡短說明。" },
          { role: "user", content: prompt },
        ],
      });
      return completion.choices[0].message?.content || "無法生成說明";
    } catch (err) {
      console.error("[SEM] ❌ ai-query 失敗", err);
      return "AI 錯誤";
    }
  });

  console.log("[IPC] ✅ Semantic IPC registered (ai-query / get-related-notes / generate-ai-relations)");
}
