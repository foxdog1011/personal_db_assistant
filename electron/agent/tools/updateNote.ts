import { updateNote as updateNoteSvc } from "../../services/notes_service";
import type { Tool } from "./types";

export interface UpdateNoteInput { id: number; content?: string; tags?: string; insight?: string }
export interface UpdateNoteOutput { updated: true }

const updateNoteTool: Tool<UpdateNoteInput, UpdateNoteOutput> = {
  name: "updateNote",
  description: "Update note content/tags/insight and rebuild relations.",
  examples: [
    { input: { id: 1, content: "New text" }, description: "Replace content and rebuild relations" },
    { input: { id: 1, tags: "work,reading" }, description: "Patch only tags" },
  ],
  async run(ctx, input) {
    const res = await updateNoteSvc(ctx.db, input);
    if (!res.success) throw new Error(res.error || "update failed");
    return { updated: true };
  },
};

export default updateNoteTool;
