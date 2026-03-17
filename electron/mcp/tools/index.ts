import type { ToolContext } from "../../agent/tools/types";
import { registerSearchNotesTool } from "./searchNotesTool";
import { registerGetNoteTool } from "./getNoteTool";
import { registerSemanticSearchNotesTool } from "./semanticSearchNotesTool";
import { registerRunBriefTool } from "./runBriefTool";
import { registerRunWritingTool } from "./runWritingTool";
import { registerRunReviewTool } from "./runReviewTool";

export function registerAllTools(server: any, ctx: ToolContext) {
  registerSearchNotesTool(server, ctx);
  registerGetNoteTool(server, ctx);
  registerSemanticSearchNotesTool(server, ctx);
  registerRunBriefTool(server, ctx);
  registerRunWritingTool(server, ctx);
  registerRunReviewTool(server, ctx);
}

