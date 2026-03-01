import { ipcMain } from "electron";
import type sqlite3 from "sqlite3";
import type OpenAI from "openai";
import { extractTriples } from "../ai/extractTriples";
import { saveTriples } from "../db/query";
import { buildRelations } from "../services/relation_service";
import { summarizeText, generateInsight } from "../services/ai_service";
import { enqueueJob } from "../services/ai_job_queue";
import { logger } from "../utils/logger";

export interface IpcContext {
  db: sqlite3.Database;
  openai: OpenAI;
}

/** 知識演化 */
async function evolveKnowledge(
  db: sqlite3.Database,
  noteId: number,
  content: string,
  summary: string
) {
  const insight = await generateInsight(content, summary);
  db.run("UPDATE notes SET insight = ? WHERE id = ?", [insight, noteId]);
  console.log(`[AI] evolveKnowledge: note ${noteId} updated.`);
}

/** 註冊 Note IPC */
export function registerNoteIpc(ctx: IpcContext) {
  const { db, openai } = ctx;

  /** 💾 新增筆記 */
  ipcMain.handle("add-note", async (_, { content, tags }) => {
    return new Promise((resolve) => {
      db.run(
        `INSERT INTO notes (content, tags, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
        [content, tags || ""],
        async function (err) {
          if (err) {
            console.error("[DB] add-note:error", err);
            return resolve({ success: false, error: err.message });
          }

          const noteId = this.lastID;
          logger.info("[DB] add-note", { noteId });

          try {
            await enqueueJob(db, noteId, "summary");
            await enqueueJob(db, noteId, "triples");
            await enqueueJob(db, noteId, "embedding");
          } catch (e: any) {
            logger.error("[QUEUE] enqueue failed after add-note", { noteId, error: e?.message });
          }

          resolve({ success: true, id: noteId });
        }
      );
    });
  });

  /** ✏️ 更新筆記 */
  ipcMain.handle("update-note", async (_, { id, content, tags, insight }) => {
    return new Promise((resolve) => {
      db.run(
        `UPDATE notes SET content=?, tags=?, insight=? WHERE id=?`,
        [content, tags || "", insight || "", id],
        async (err) => {
          if (err) {
            console.error("[DB] update-note:error", err);
            return resolve({ success: false });
          }
          await buildRelations(db, id, content);
          console.log(`[DB] update-note: note ${id} updated`);
          resolve({ success: true });
        }
      );
    });
  });

  /** 🔍 搜尋筆記 */
  ipcMain.handle("search-note", async (_, { query }) => {
    return new Promise((resolve) => {
      db.all(
        `SELECT * FROM notes WHERE content LIKE ? OR tags LIKE ? ORDER BY created_at DESC`,
        [`%${query || ""}%`, `%${query || ""}%`],
        (err, rows) => {
          if (err) {
            console.error("[DB] search-note:error", err);
            return resolve([]);
          }
          resolve(rows);
        }
      );
    });
  });

  /** 🗑 刪除筆記 */
  ipcMain.handle("delete-note", async (_, id: number) => {
    db.run("DELETE FROM notes WHERE id = ?", [id]);
    console.log("[DB] delete-note:", id);
    return { success: true };
  });

  /** 🎨 更新顏色 */
  ipcMain.handle("update-color", async (_, { id, color }) => {
    return new Promise((resolve) => {
      db.run("UPDATE notes SET color = ? WHERE id = ?", [color, id], (err) =>
        err
          ? resolve({ success: false, error: err.message })
          : resolve({ success: true })
      );
    });
  });

  /** 📌 釘選/取消釘選 */
  ipcMain.handle("toggle-pin", async (_, id: number) => {
    return new Promise((resolve) => {
      db.get("SELECT pinned FROM notes WHERE id = ?", [id], (err, row: any) => {
        if (err) {
          console.error("[DB] toggle-pin:error", err);
          return resolve({ success: false });
        }
        const newPinned = row?.pinned === 1 ? 0 : 1;
        db.run("UPDATE notes SET pinned = ? WHERE id = ?", [newPinned, id]);
        console.log(`[DB] toggle-pin: note ${id} -> ${newPinned}`);
        resolve({ success: true, pinned: newPinned });
      });
    });
  });
    /* =====================================================
   * ✨ AI 生成摘要
   * ===================================================== */
  ipcMain.handle("generateSummary", async (_event, { id, content }) => {
    try {
      const { summary } = await summarizeText(content);

      db.run(
        "UPDATE notes SET summary = ? WHERE id = ?",
        [summary, id],
        (err) => {
          if (err) {
            console.error("[AI] ❌ generateSummary:update error", err);
          } else {
            console.log(`[AI] ✅ Summary generated for note ${id}`);
          }
        }
      );

      return { success: true, summary };
    } catch (err: any) {
      console.error("[AI] generateSummary:error", err);
      return { success: false, error: err?.message || String(err) };
    }
  });

}
