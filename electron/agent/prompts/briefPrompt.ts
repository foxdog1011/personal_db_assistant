import type { ResearchNoteItem } from "./researchSummaryPrompt";

export function buildBriefPrompt(task: string, notes: ResearchNoteItem[]): string {
  const header = `You are a knowledge assistant producing concise, evidence-grounded briefs.\nTask: ${task}\nGuidelines:\n- Use ONLY the selected notes below. Do not invent updates, risks, or next steps.\n- Prefer short, concrete bullets. Avoid generic business filler.\n- If a section has no direct evidence, return an empty array in JSON and omit in markdown.\n- Where practical, reference supporting note ids in parentheses, e.g., (notes: #3,#7).\n---`;
  const body = notes
    .map(
      (n, i) => `Note ${i + 1} (id=${n.id}):\n${n.preview}${n.tags ? `\nTags: ${n.tags}` : ""}`
    )
    .join("\n\n");
  const tail = `\n---\nReturn JSON then markdown.\nJSON schema: {"keyUpdates": string[], "risks": string[], "nextSteps": string[]}\nThen a markdown brief under 250 words with three sections (Key Updates, Risks / Blockers, Next Steps).\nIn bullets, optionally append supporting note ids in the form (notes: #id,#id).`;
  return `${header}\n${body}${tail}`;
}
