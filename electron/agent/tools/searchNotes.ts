import { searchNotes as searchNotesSvc } from "../../services/notes_service";
import type { Tool } from "./types";

export interface SearchNotesInput { query: string; limit?: number }
export interface SearchNotesOutput { items: Awaited<ReturnType<typeof searchNotesSvc>> }

const searchNotesTool: Tool<SearchNotesInput, SearchNotesOutput> = {
  name: "searchNotes",
  description: "Keyword search across notes content and tags (DB LIKE).",
  examples: [
    { input: { query: "graph", limit: 10 }, description: "Find top 10 notes mentioning 'graph'" },
  ],
  async run(ctx, input) {
    const rows = await searchNotesSvc(ctx.db, { query: input.query, limit: input.limit });
    return { items: rows };
  },
};

export default searchNotesTool;
