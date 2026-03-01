import { ipcMain } from "electron";
import type OpenAI from "openai";

export function registerReflectionIpc(openai: OpenAI) {
  /**
   * 🧠 根據筆記內容生成反思問題
   */
  ipcMain.handle(
    "generate-reflection-questions",
    async (_event, content: string) => {
      const prompt = `
你是一位 「思維啟發導師」，專門針對使用者剛寫完的一則筆記內容，  
幫助他從更深、更廣、更個人化的角度進行反思，創造能促進理解、應用與行動的問題。

以下是筆記內容：
---  
${content}  
---

請依照以下步驟操作：

1. 先簡短描述這則筆記的 **核心主題／概念**（約 1-2 句）。  
2. 接著生成 **3 個反思問題**，每一題內容應符合下面 “A B C” 結構：  
   - **A（理解層）**：你能用一句話描述這主題在你的生活／工作中意味什麼嗎？  
   - **B（應用層）**：如果你要將這主題應用到 「下週／接下來一項專案」中，你會怎麼做？  
   - **C（挑戰層）**：有什麼慣性、假設或障礙可能會讓你無法真正落實？你打算怎麼突破它？

3. 請把每題前面標號 1. 2. 3.，並保持語氣真誠、啟發性、高互動感。

4. 最後，寫一句簡短的 “行動挑戰”（約 1 句），鼓勵使用者在 48 小時內採取一項小步驟落實這則筆記。

---

請開始：

`;

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.8,
        });

        const text = completion.choices[0]?.message?.content ?? "";
        const questions = text
          .split(/\n+/)
          .map((q) => q.replace(/^\d+\.\s*/, "").trim())
          .filter(Boolean);

        console.log("[AI Reflection] Generated questions:", questions);
        return { success: true, questions };
      } catch (err) {
        console.error("[AI Reflection] Error:", err);
        return { success: false, questions: [] };
      }
    }
  );
}
