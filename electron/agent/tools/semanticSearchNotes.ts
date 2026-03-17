import { getSemanticNotes } from "../../services/semantic_notes";
import type { Tool } from "./types";

export interface SemanticSearchNotesInput { noteId: number; k?: number }
export type SemanticSearchNotesOutput = Awaited<ReturnType<typeof getSemanticNotes>>;

const semanticSearchNotesTool: Tool<SemanticSearchNotesInput, SemanticSearchNotesOutput> = {
  name: "semanticSearchNotes",
  description: "Find semantically similar notes to a given note (embedding cosine/overlap).",
  examples: [
    { input: { noteId: 1, k: 5 }, description: "Top 5 semantic neighbors for note 1" },
  ],
  async run(ctx, input) {
    return getSemanticNotes(ctx.db, { noteId: String(input.noteId), k: input.k });
  },
};

export default semanticSearchNotesTool;
