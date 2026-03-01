import type sqlite3 from "sqlite3";
import OpenAI from "openai";
import { extractTriples } from "../ai/extractTriples";

export type Triple = { source: string; relation: string; target: string };

/** 使用主 Triple 模組進行抽取 */
export async function extractKnowledgeTriples(
  content: string
): Promise<Triple[]> {
  try {
    // ✅ 自動建立 OpenAI 實例
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const triples = await extractTriples(openai, content);
    return triples;
  } catch (e: any) {
    console.error("[KG] extractKnowledgeTriples:error", e?.message || e);
    return [];
  }
}

/** 儲存至 concept_relations */
export function saveTriples(
  db: sqlite3.Database,
  noteId: number,
  triples: Triple[]
) {
  try {
    db.serialize(() => {
      db.run("DELETE FROM concept_relations WHERE note_id = ?", [noteId]);
      const stmt = db.prepare(
        "INSERT INTO concept_relations (source, relation, target, note_id) VALUES (?, ?, ?, ?)"
      );
      triples.forEach((t) => stmt.run(t.source, t.relation, t.target, noteId));
      stmt.finalize();
    });
    console.log(`[KG] saveTriples: ${triples.length} 條關係 (note ${noteId})`);
  } catch (e) {
    console.error("[KG] saveTriples:error", e);
  }
}
