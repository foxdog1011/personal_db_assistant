export interface ResearchNoteItem {
  id: number;
  preview: string;
  tags?: string | null;
}

export function buildResearchSummaryPrompt(task: string, notes: ResearchNoteItem[]): string {
  const header = `You are a precise research summarizer.\n` +
    `Task: ${task}\n` +
    `---\n`;

  const body = notes.map((n, idx) => {
    const tagLine = n.tags && n.tags.trim() ? `\nTags: ${n.tags}` : "";
    return `Note ${idx + 1} (id=${n.id}):\n${n.preview}${tagLine}`;
  }).join("\n\n");

  const tail = `\n---\n` +
    `Produce a concise, structured summary with:\n` +
    `- Key insights (bullets)\n` +
    `- Notable references (note ids)\n` +
    `- Suggested next steps (bullets)\n` +
    `Reply in markdown, keep under 250 words.`;

  return header + body + tail;
}

