/*  Dev-only smoke test for Knowledge Task Runner  */
import { initDatabase, getDb } from "../../db/init";
import { runKnowledgeTask } from "./knowledgeTaskRunner";

async function main() {
  initDatabase();
  const db = getDb();
  const ctx = { db };

  const res = await runKnowledgeTask(ctx, {
    task: "knowledge graph",
    mode: "brief",
    maxNotes: 4,
    expandSemantic: true,
    saveAsNote: false,
  });

  console.log("[KTASK] result: mode=", res.mode, "task=", res.task);
  console.log("[KTASK] selected ids=", res.selected.map((s) => s.id));
  console.log("[KTASK] markdown preview=", res.output.markdown.slice(0, 200));
}

main().catch((e) => {
  console.error("[RESEARCH] smoke error", e);
  process.exit(1);
});
