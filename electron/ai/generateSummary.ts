import type sqlite3 from "sqlite3";
import type OpenAI from "openai";

export async function generateSummaryById(
  db: sqlite3.Database,
  openai: OpenAI,
  args: { id: number; content?: string }
): Promise<{ success: boolean; id: number; summary?: string; error?: string }> {
  const { id, content: passedContent } = args;

  try {
    // 1️⃣ 從 DB 撈舊內容
    const row: { content?: string } | undefined = await new Promise((resolve) => {
      db.get("SELECT content FROM notes WHERE id = ?", [id], (err, r) => {
        if (err) {
          console.error("[DB] read-note:error", err);
          return resolve(undefined);
        }
        resolve(r as any);
      });
    });

    // 2️⃣ 若前端有 content，優先使用
    const content = (passedContent || row?.content || "").trim();

    if (!content) {
      console.warn(`[AI] generate-summary:error 空內容 (id=${id})`);
      return { success: false, id, error: "內容為空，無法生成摘要。" };
    }

    // 3️⃣ 呼叫 OpenAI
    const prompt = `請以繁體中文撰寫一段簡潔的摘要，總結以下內容的重點：\n\n${content}`;
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
    });

    const summary = res.choices?.[0]?.message?.content?.trim() || "";

    console.log("[AI] generate-summary:done", { id, summaryLength: summary.length });

    // 4️⃣ 寫回 DB
    await new Promise<void>((resolve) => {
      db.run(`UPDATE notes SET summary = ? WHERE id = ?`, [summary, id], () => resolve());
    });

    return { success: true, id, summary };
  } catch (err: any) {
    console.error("[AI] generate-summary:error", err);
    return { success: false, id, error: err?.message || String(err) };
  }
}
