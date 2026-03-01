import type OpenAI from "openai";

export interface Triple {
  source: string;
  relation: string;
  target: string;
}

/**
 * 使用 OpenAI 抽取文字中的知識三元組（Triples）
 * @param openai OpenAI 實例
 * @param content 輸入內容
 * @returns Triple 陣列
 */
export async function extractTriples(
  openai: OpenAI,
  content: string
): Promise<Triple[]> {
  if (!content?.trim()) return [];

  if (process.env.MOCK_OPENAI === "1") {
    return [{ source: "mock", relation: "test", target: "note" }];
  }

  const prompt = `
請從以下文字中抽取所有「概念關聯」三元組，格式為 JSON 陣列。
每個元素包含：
- source（主詞概念）
- relation（關係）
- target（受詞概念）
請只輸出 JSON，不要多餘說明。

範例：
輸入：「生成式AI需要大量訓練資料，提示工程可以提升生成品質。」
輸出：
[
  {"source":"生成式AI","relation":"需要","target":"大量訓練資料"},
  {"source":"提示工程","relation":"提升","target":"生成品質"}
]

內容如下：
${content}
`;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "你是一位知識三元組抽取專家。" },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    });

    const text = res.choices?.[0]?.message?.content?.trim() || "[]";
    const parsed = safeJSONParse(text);

    const triples = Array.isArray(parsed)
      ? parsed.filter((t: any) => t.source && t.relation && t.target)
      : [];

    console.log(`[AI] ✅ extractTriples: ${triples.length} 條成功`);
    return triples;
  } catch (e: any) {
    console.error("[AI] ❌ extractTriples:error", e?.message || e);
    return [];
  }
}

/**
 * 安全 JSON.parse（防止模型輸出非 JSON）
 */
function safeJSONParse(text: string): any {
  try {
    // 🔹 移除 code block 標籤
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn("[AI] JSON parse fallback");
    try {
      // 若非標準 JSON，嘗試從字串中提取 JSON 區塊
      const match = text.match(/\[[\s\S]*\]/);
      return match ? JSON.parse(match[0]) : [];
    } catch {
      return [];
    }
  }
}
