/* Minimal MCP server exposing local Knowledge Tasks + Notes tools via stdio. */
import { initDatabase, getDb } from "../db/init";
import type { ToolContext } from "../agent/tools/types";
import { registerAllTools } from "./tools";
import { logger } from "../utils/logger";

// Use require() to avoid TS compile errors if packages aren't installed yet
// Updated to use installed SDK package paths
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");

async function main() {
  initDatabase();
  const db = getDb();

  const server = new McpServer({ name: "knowledge-tasks-mcp", version: "0.1.0" });
  const ctx: ToolContext = { db, logger } as any;

  registerAllTools(server, ctx);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // IMPORTANT: log to stderr to avoid interfering with stdio transport
  console.error("[MCP] Server started on stdio", { tools: [
    "search_notes",
    "get_note",
    "semantic_search_notes",
    "run_brief",
    "run_writing",
    "run_review",
  ]});
}

main().catch((e) => {
  console.error("[MCP] fatal", e);
  process.exit(1);
});
