import { toolMap } from "../../agent/tools";
import type { ToolContext } from "../../agent/tools/types";

export function registerGetNoteTool(server: any, ctx: ToolContext) {
  const inputSchema = {
    type: "object",
    properties: { id: { type: "number" } },
    required: ["id"],
  };

  server.tool?.("get_note", { description: "Get a note by id", inputSchema }, async (req: any) => {
    const { id } = req?.params ?? req?.input ?? {};
    const row = await toolMap.getNoteById.run(ctx, { id: Number(id) });
    return { content: [{ type: "text", text: JSON.stringify({ note: row || null }) }] };
  });
}

