import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function extractTriplesFromNote(content: string) {
  const prompt = `
  你是一個知識圖譜抽取器，請從以下文字中萃取出「主詞、關係、受詞」三元組，限5組以內。
  請用 JSON 陣列輸出，例如：
  [{"subject": "AI 模型", "predicate": "可以", "object": "生成架構設計"}]

  文字內容：
  """${content}"""
  `;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });

  try {
    const text = completion.choices[0].message.content?.trim() || "[]";
    const parsed = JSON.parse(text);
    return parsed;
  } catch {
    console.error("⚠️ 解析三元組失敗");
    return [];
  }
}
