/*
  Dev-only smoke test for agent tools.
  Usage: npm run agent:smoke
*/
import { initDatabase, getDb } from "../db/init";
import { tools, toolMap } from "./tools";

async function main() {
  initDatabase();
  const db = getDb();
  const ctx = { db };

  console.log("[SMOKE] tools loaded:", tools.map(t => t.name));

  // 1) createNote
  const created = await toolMap.createNote.run(ctx, { content: "Smoke test note", tags: "smoke,test" });
  console.log("[SMOKE] createNote ->", created);

  // 2) searchNotes
  const found = await toolMap.searchNotes.run(ctx, { query: "Smoke", limit: 5 });
  console.log("[SMOKE] searchNotes -> count=", found.items.length);

  // 3) updateNote
  await toolMap.updateNote.run(ctx, { id: created.id, tags: "smoke,updated" });
  console.log("[SMOKE] updateNote -> done");

  // 4) getNoteById
  const note = await toolMap.getNoteById.run(ctx, { id: created.id });
  console.log("[SMOKE] getNoteById ->", note?.id, note?.tags);

  // 5) semanticSearchNotes (may return empty if few notes)
  const sem = await toolMap.semanticSearchNotes.run(ctx, { noteId: created.id, k: 3 });
  console.log("[SMOKE] semanticSearchNotes ->", sem.related?.length ?? 0);
}

main().catch((e) => {
  console.error("[SMOKE] error", e);
  process.exit(1);
});

