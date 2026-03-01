import * as dotenv from "dotenv";
dotenv.config();

let openaiClient: any = null;

/** ✅ 確保單例 OpenAI Client */
async function getOpenAI() {
  if (openaiClient) return openaiClient;
  const { default: OpenAI } = await import("openai");
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("[AI] Missing OPENAI_API_KEY");
  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

/** 🧠 通用 AI 呼叫封裝 */
async function callChatModel(prompt: string, temperature = 0.7) {
  if (process.env.MOCK_OPENAI === "1") {
    return "[MOCK] 這是一段模擬摘要。\n標籤: mock, test, demo";
  }
  const openai = await getOpenAI();
  const t0 = Date.now();
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature,
    max_tokens: 800,
  });
  const dt = Date.now() - t0;
  console.log("[AI] callChatModel: response-time(ms)", dt);
  return res.choices?.[0]?.message?.content?.trim() ?? "";
}

/** 📝 摘要與標籤 */
export async function summarizeText(content: string): Promise<{ summary: string; tags: string[] }> {
  console.log("[AI] summarizeText:start", { len: content?.length ?? 0 });
  if (!content?.trim()) return { summary: "", tags: [] };

  const systemPrompt = `
你是一位筆記摘要助手，請摘要以下內容並提取主題與三個標籤（格式：標籤: ...）
---
${content}
---
`;

  const raw = await callChatModel(systemPrompt, 0.5);
  const marker = "標籤:";
  const idx = raw.indexOf(marker);
  const summary = (idx >= 0 ? raw.slice(0, idx) : raw).trim();
  const tagsPart = idx >= 0 ? raw.slice(idx + marker.length) : "";
  const tags = tagsPart
    .split(/[，,]+/)
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0)
    .slice(0, 3);

  console.log("[AI] summarizeText:parsed", { summaryLength: summary.length, tags });
  return { summary, tags };
}

/** 💡 Insight 延伸思考 */
export async function generateInsight(content: string, summary = "", userInsight = "") {
  const prompt = `
這是一則使用者筆記，請根據以下三個面向，產生延伸思考與啟發問題：
1️⃣ 筆記原始內容
2️⃣ AI 摘要
3️⃣ 使用者的個人心得
---
📄 筆記內容：
${content}

📘 摘要：
${summary || "（尚未提供摘要）"}

💬 使用者心得：
${userInsight || "（尚未輸入心得）"}
---
🎯 請以「Apple Notes × Notion AI」語氣，產生一段 80–120 字的延伸思考。
`;
  const insight = await callChatModel(prompt, 0.8);
  console.log("[AI] generateInsight:done");
  return insight;
}

/** 💭 反思題目 */
export async function generateReflection(content: string) {
  const prompt = `
You are a "Reflection Question Generator".
Based on the following note content, generate 3 deep reflective questions that encourage critical thinking:
---
${content}
---
Output JSON: {"questions": ["...", "...", "..."]}
`;
  try {
    const raw = await callChatModel(prompt, 0.8);
    const parsed = JSON.parse(raw);
    return parsed.questions || [];
  } catch (err) {
    console.error("[AI] generateReflection:parse-error", err);
    return [];
  }
}

/** 🤖 通用查詢 */
export async function generalQuery(prompt: string) {
  return await callChatModel(prompt, 0.7);
}
