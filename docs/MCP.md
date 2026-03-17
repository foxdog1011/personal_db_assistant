# Minimal MCP Server — Notes + Knowledge Tasks

This repo includes a minimal MCP (Model Context Protocol) stdio server that exposes the app’s most valuable local capabilities:

- Notes
- Knowledge Tasks
  - Brief (primary)
  - Writing (secondary)
  - Review (supporting)

The MCP layer is intentionally thin and reuses existing logic from the agent tool layer and the Knowledge Task runner.

## Why stdio
- Local-first, simple transport
- No extra networking or auth
- Works well with MCP-compatible clients for quick local demos

## Tools Exposed
- `search_notes` — keyword search; returns note ids, tags, preview
- `get_note` — fetch a single note by id
- `semantic_search_notes` — related notes using embeddings/overlap
- `run_brief` — fixed-flow Knowledge Task in brief mode
- `run_writing` — fixed-flow Knowledge Task in writing mode
- `run_review` — fixed-flow Knowledge Task in review mode

## Mapping to Product Story
- Notes: Use `search_notes`, `get_note`, `semantic_search_notes`
- Knowledge Tasks: `run_brief`, `run_writing`, `run_review`
  - The MCP server calls the same deterministic retrieval pipeline and runner used by the app

## Local Run
1) Install dependencies
- `npm install`
- If you see MCP packages missing, install:
  - `npm i @modelcontextprotocol/server @modelcontextprotocol/transport-node zod`

2) Start the MCP stdio server
- `npm run mcp`
- It prints: `[MCP] Server started on stdio` and registers the six tools above

3) Optional offline mode
- `MOCK_OPENAI=1` to avoid network; embeddings and summaries use mock flows

## Smoke / Demo Examples
Below are example invocations (tool name + input JSON + expected shape). Use an MCP-compatible client to send requests over stdio.

### 1) search_notes
- Tool: `search_notes`
- Input:
```json
{ "query": "brief", "limit": 5 }
```
- Output shape:
```json
{ "items": [ { "id": 12, "tags": "...", "preview": "..." } ] }
```
- Value: Shows quick retrieval of relevant notes for grounding.

### 2) run_brief
- Tool: `run_brief`
- Input:
```json
{ "task": "Summarize the last two weeks of Knowledge Tasks work into a meeting brief", "maxNotes": 6, "expandSemantic": true }
```
- Output shape:
```json
{ "task": "...", "mode": "brief", "selected": [ {"id": 1, "preview": "...", "source": "keyword" } ], "output": { "mode": "brief", "markdown": "...", "json": { "keyUpdates": [], "risks": [], "nextSteps": [] } }, "trace": { "keywordHits": [] } }
```
- Value: Produces a compact, evidence-grounded brief.

### 3) run_writing
- Tool: `run_writing`
- Input:
```json
{ "task": "Turn my notes about cloud cost optimization into a proposal draft", "maxNotes": 6, "expandSemantic": true }
```
- Output shape:
```json
{ "task": "...", "mode": "writing", "selected": [ ... ], "output": { "mode": "writing", "markdown": "## Problem...", "json": { "title": "...", "outline": ["Problem", "Why Brief is the Primary Workflow", "How the System Works", "How Writing and Review Support the Workflow", "Product Boundaries"], "draft": "..." } }, "trace": { ... } }
```
- Value: Produces a grounded, product-specific draft using the fixed template.

## Quick Verification
- Dev-friendly script: `npm run mcp:smoke`
  - Compiles and launches the server
  - Waits for `[MCP] Server started` message then exits success
- For tool calls, use any local MCP client. The server is stdio/local-first and does not open network ports.

## Files
- `electron/mcp/server.ts` — stdio server entry
- `electron/mcp/tools/*.ts` — MCP tool wrappers (thin)
- Reused logic: `electron/agent/tools`, `electron/agent/runner/knowledgeTaskRunner.ts`
