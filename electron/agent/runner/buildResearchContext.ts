import type { Note } from "../tools/types";

export interface BuiltContextItem {
  id: number;
  preview: string;
  tags?: string | null;
}

export function buildResearchContext(notes: Note[], maxCharsPerNote = 500): BuiltContextItem[] {
  return notes.map((n) => ({
    id: n.id,
    preview: (n.summary && n.summary.trim().length > 0 ? n.summary : n.content).slice(0, maxCharsPerNote).trim(),
    tags: n.tags ?? undefined,
  }));
}

