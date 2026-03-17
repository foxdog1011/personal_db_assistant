import { toolMap } from "../../agent/tools";
import type { ToolContext } from "../../agent/tools/types";

export function registerSearchNotesTool(server: any, ctx: ToolContext) {
  const inputSchema = {
    type: "object",
    properties: {
      query: { type: "string" },
      limit: { type: "number" },
    },
    required: ["query"],
  };

  server.tool?.("search_notes", { description: "Search notes by keyword", inputSchema }, async (req: any) => {
    const { query, limit } = req?.params ?? req?.input ?? {};
    const res = await toolMap.searchNotes.run(ctx, { query: String(query || ""), limit: typeof limit === "number" ? limit : undefined });
    const items = (res || []).map((n: any) => ({
      id: n.id,
      tags: n.tags || "",
      preview: String((n.summary && n.summary.trim()) ? n.summary : n.content).slice(0, 180),
    }));
    return { content: [{ type: "text", text: JSON.stringify({ items }) }] };
  });
}

