import { toolMap } from "../../agent/tools";
import type { ToolContext } from "../../agent/tools/types";

export function registerSemanticSearchNotesTool(server: any, ctx: ToolContext) {
  const inputSchema = {
    type: "object",
    properties: {
      noteId: { type: "number" },
      k: { type: "number" },
    },
    required: ["noteId"],
  };

  server.tool?.("semantic_search_notes", { description: "Find semantically related notes", inputSchema }, async (req: any) => {
    const { noteId, k } = req?.params ?? req?.input ?? {};
    const res = await toolMap.semanticSearchNotes.run(ctx, { noteId: Number(noteId), k: typeof k === "number" ? k : undefined });
    return { content: [{ type: "text", text: JSON.stringify(res) }] };
  });
}

