import fs from "fs";
import path from "path";
import { initDatabase, getDb } from "../db/init";
import { createNote } from "../services/notes_service";
import type sqlite3 from "sqlite3";

interface SeedNote {
  title: string;
  content: string;
  tags?: string;
  type?: string;
  createdAt?: string; // YYYY-MM-DD HH:MM:SS
}

function readSeedFile(): SeedNote[] {
  const fp = path.join(process.cwd(), "scripts", "seed_notes.json");
  if (!fs.existsSync(fp)) throw new Error(`Seed file not found: ${fp}`);
  const raw = fs.readFileSync(fp, "utf-8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error("Invalid seed file: expected an array");
  return data as SeedNote[];
}

function formatContent(title: string, content: string): string {
  const t = title?.trim() || "Untitled";
  const c = (content || "").trim();
  return `# ${t}\n\n${c}`;
}

async function existsNote(db: sqlite3.Database, content: string): Promise<boolean> {
  return new Promise((resolve) => {
    db.get("SELECT id FROM notes WHERE content = ? LIMIT 1", [content], (err, row) => {
      if (err) return resolve(false);
      resolve(!!row);
    });
  });
}

async function main() {
  console.log("[SEED] Initializing DB...");
  initDatabase();
  const db = getDb();

  const items = readSeedFile();
  console.log(`[SEED] Loaded ${items.length} notes from scripts/seed_notes.json`);

  let inserted = 0;
  let skipped = 0;
  for (const n of items) {
    const body = formatContent(n.title, n.content);
    const already = await existsNote(db, body);
    if (already) {
      skipped++;
      console.log(`[SEED] Skip (exists): ${n.title}`);
      continue;
    }
    const res = await createNote(db, { content: body, tags: n.tags || "", type: n.type || "text", createdAt: n.createdAt });
    if (res.success) {
      inserted++;
      console.log(`[SEED] Inserted: ${n.title} (id=${res.id})`);
    } else {
      console.warn(`[SEED] Failed: ${n.title} → ${res.error}`);
    }
  }

  console.log(`[SEED] Done. inserted=${inserted} skipped=${skipped}`);
  console.log(`[SEED] Tip: set MOCK_OPENAI=1 to avoid network; AI jobs will still enqueue for embeddings/summary.`);
}

main().catch((e) => {
  console.error("[SEED] error", e);
  process.exit(1);
});

