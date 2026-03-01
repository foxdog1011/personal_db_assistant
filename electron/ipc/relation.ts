// ✅ electron/ipc/relation.ts
import { ipcMain } from "electron";
import type { Database } from "sqlite3";
import { getRelatedNotes, buildRelations } from "../services/relation_service";

export function registerRelationIpc(db: Database) {
  /** 🤖 生成 AI 建議關聯 */
  ipcMain.handle("generate-ai-relations", async (_event, { id, content }) => {
    console.log(`[REL] 🤖 生成 AI 關聯 for noteId=${id}`);
    try {
      const result = await buildRelations(db, id, content);
      const count = Array.isArray(result) ? result.length : 0;
      console.log(`[REL] ✅ 已建立 ${count} 筆關聯 for note ${id}`);
      return { success: true, count };
    } catch (err) {
      console.error("[REL] ❌ 生成 AI 關聯失敗", err);
      return { success: false, error: String(err) };
    }
  });

  /** 🔍 查詢關聯筆記 */
  ipcMain.handle("get-related-notes", async (_e, noteId: number) => {
    try {
      const notes = await getRelatedNotes(db, noteId, 10);
      console.log(`[REL] ✅ 傳回 ${notes.length} 筆關聯筆記 for noteId=${noteId}`);
      return notes;
    } catch (err) {
      console.error("[REL] ❌ 取得關聯筆記失敗", err);
      return [];
    }
  });
}
