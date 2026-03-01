import { ipcMain } from "electron";
import { summarizeText, generateInsight, generateReflection, generalQuery } from "../services/ai_service";
import type sqlite3 from "sqlite3";

export interface IpcContext {
  db: sqlite3.Database;
}

export function registerAiIpc(ctx: IpcContext) {
  const { db } = ctx;

  /** ✨ AI 摘要 */
  ipcMain.handle("generate-summary", async (_event, { id, content }) => {
    try {
      const { summary, tags } = await summarizeText(content);
      db.run("UPDATE notes SET summary = ?, tags = ? WHERE id = ?", [summary, tags.join(","), id]);
      console.log("[AI] Summary updated ✅", { id });
      return { success: true, summary, tags };
    } catch (err) {
      console.error("[AI] generate-summary:error", err);
      return { success: false, summary: "", tags: [] };
    }
  });

  /** ✨ Insight */
  ipcMain.handle("generate-insight", async (_event, { id, content, summary, insight }) => {
    try {
      const aiInsight = await generateInsight(content, summary, insight);
      db.run("UPDATE notes SET insight = ? WHERE id = ?", [aiInsight, id]);
      return { success: true, insight: aiInsight };
    } catch (err) {
      console.error("[AI] generate-insight:error", err);
      return { success: false, insight: "" };
    }
  });

  /** 💭 反思問題 */
  ipcMain.handle("generate-reflection", async (_event, { content }) => {
    try {
      const questions = await generateReflection(content);
      return { success: true, questions };
    } catch (err) {
      console.error("[AI] generate-reflection:error", err);
      return { success: false, questions: [] };
    }
  });
}
