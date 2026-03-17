import { runKnowledgeTask } from "../../agent/runner/knowledgeTaskRunner";
import type { ToolContext } from "../../agent/tools/types";

export function registerRunWritingTool(server: any, ctx: ToolContext) {
  const inputSchema = {
    type: "object",
    properties: {
      task: { type: "string" },
      maxNotes: { type: "number" },
      expandSemantic: { type: "boolean" },
    },
    required: ["task"],
  };

  server.tool?.("run_writing", { description: "Run Knowledge Task (writing mode)", inputSchema }, async (req: any) => {
    const { task, maxNotes, expandSemantic } = req?.params ?? req?.input ?? {};
    const result = await runKnowledgeTask(ctx, {
      task: String(task || ""),
      mode: "writing",
      maxNotes: typeof maxNotes === "number" ? maxNotes : undefined,
      expandSemantic: !!expandSemantic,
      saveAsNote: false,
    });
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });
}

