import { createNote as createNoteSvc, type CreateNoteInput } from "../../services/notes_service";
import type { Tool } from "./types";

export type CreateNoteInputTool = Pick<CreateNoteInput, "content" | "tags" | "type">;
export interface CreateNoteOutputTool { id: number }

const createNoteTool: Tool<CreateNoteInputTool, CreateNoteOutputTool> = {
  name: "createNote",
  description: "Create a new note and enqueue AI jobs (summary, triples, embedding).",
  examples: [
    { input: { content: "My note", tags: "idea,personal" }, description: "Create a note with tags" },
  ],
  async run(ctx, input) {
    const res = await createNoteSvc(ctx.db, { content: input.content, tags: input.tags, type: input.type });
    if (!res.success || !res.id) throw new Error(res.error || "createNote failed");
    return { id: res.id };
  },
};

export default createNoteTool;
