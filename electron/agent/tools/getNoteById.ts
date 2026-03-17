import { getNoteById as getNoteByIdSvc } from "../../services/notes_service";
import type { Tool } from "./types";

export interface GetNoteByIdInput { id: number }
export type GetNoteByIdOutput = Awaited<ReturnType<typeof getNoteByIdSvc>>;

const getNoteByIdTool: Tool<GetNoteByIdInput, GetNoteByIdOutput> = {
  name: "getNoteById",
  description: "Fetch a single note row by id.",
  examples: [
    { input: { id: 1 }, description: "Load note with id 1" },
  ],
  async run(ctx, input) {
    return getNoteByIdSvc(ctx.db, input.id);
  },
};

export default getNoteByIdTool;
