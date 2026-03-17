import type { ResearchNoteItem } from "./researchSummaryPrompt";

// Template-driven Writing prompt that produces a grounded, product-specific proposal.
// EXACTLY five sections; grounded only in provided notes; JSON shape unchanged.
export function buildWritingPrompt(task: string, notes: ResearchNoteItem[]): string {
  const header = `You are a writing assistant creating a product-specific proposal grounded ONLY in the selected notes.
Task: ${task}
Guidelines:
- Use ONLY the selected notes below; do not invent content.
- Omit unsupported claims.
- Avoid generic AI/SaaS marketing phrases (e.g., "in today's fast-paced environment", "innovative solution", "enhance productivity", "streamline workflows") unless explicitly supported by the notes.
- When supported by notes, reflect product characteristics: local-first note base, deterministic retrieval, multi-seed semantic expansion, provenance/trace, and "Brief" as the primary workflow.
- You may optionally reference supporting note ids in parentheses: (notes: #3,#7).
---`;

  const body = notes
    .map((n, i) => {
      const lines: string[] = [];
      lines.push(`Note ${i + 1} (id=${n.id}):`);
      lines.push(n.preview);
      if (n.tags && n.tags.trim().length > 0) lines.push(`Tags: ${n.tags}`);
      return lines.join("\n");
    })
    .join("\n\n");

  const template = `
---
Use EXACTLY these 5 sections as markdown H2 headings (##) in this order:
1) Problem
2) Why Brief is the Primary Workflow
3) How the System Works
4) How Writing and Review Support the Workflow
5) Product Boundaries
For any section without directly supported content, include the heading and the sentence: "No directly supported content in selected notes." Do not add any other sections.`;

  const outputReq = `
---
Return JSON then markdown.
JSON schema: {"title"?: string, "outline": string[], "draft": string}
- outline MUST be exactly: ["Problem", "Why Brief is the Primary Workflow", "How the System Works", "How Writing and Review Support the Workflow", "Product Boundaries"]
- draft MUST be a markdown document containing ONLY those five sections (## headings) in that order, using content supported by the notes.`;

  return `${header}
${body}
${template}
${outputReq}`;
}
