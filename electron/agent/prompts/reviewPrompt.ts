import type { ResearchNoteItem } from "./researchSummaryPrompt";

export function buildReviewPrompt(task: string, notes: ResearchNoteItem[]): string {
  const header = `You are a knowledge-base reviewer focusing on maintenance and deduplication.\nTask: ${task}\nGuidelines:\n- Prefer pairs that share paraphrased statements or overlapping constraints; avoid speculative links.\n- Do not claim contradictions unless both sides explicitly conflict.\n---`;
  const body = notes
    .map(
      (n, i) => `Note ${i + 1} (id=${n.id}):\n${n.preview}${n.tags ? `\nTags: ${n.tags}` : ""}`
    )
    .join("\n\n");
  const tail = `\n---\nReturn JSON then markdown.\nJSON schema: {"potentialDuplicates": number[], "overlapNotes": {"id": number, "overlap": number}[], "mergeSuggestions": string[]}\n- potentialDuplicates: note IDs likely to be duplicates\n- overlapNotes: top overlapping notes with overlap in 0..1\n- mergeSuggestions: actionable suggestions\nThen provide a short markdown review (no more than 200 words).`;
  return `${header}\n${body}${tail}`;
}
