/**
 * tests/graph-evidence-flow.test.ts
 *
 * E2 tests (2):
 *   1. saveTriples(1 triple) + saveEvidenceForNote → relation_evidence has 1 row, snippet non-empty
 *   2. re-running saveEvidenceForNote for same triple → still 1 row (upsert)
 */
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { initDatabase, insertNote, closeDatabase, getDb } from "../db/manager";
import type { Database } from "sqlite3";

// ── Helpers (mirror electron/ functions without Electron imports) ─────────────

function canonicalize(input: string): string {
  let s = (input ?? "").trim();
  if (!s) return "";
  if (s.normalize) s = s.normalize("NFKC");
  s = s.toLowerCase();
  s = s.replace(/\s+/g, " ");
  s = s.replace(/^[\s\.,:;()\[\]{}"'`，。！？!？]+/, "");
  s = s.replace(/[\s\.,:;()\[\]{}"'`，。！？!？]+$/, "");
  return s;
}

function saveTriples(
  db: Database,
  noteId: number,
  triples: { source: string; relation: string; target: string }[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    db.serialize(() => {
      db.run("DELETE FROM concept_relations WHERE note_id = ?", [noteId]);
      const stmt = db.prepare(
        "INSERT INTO concept_relations (source, relation, target, note_id, canonical_source, canonical_target, support_count, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      );
      triples.forEach((t) =>
        stmt.run(
          t.source, t.relation, t.target, noteId,
          canonicalize(t.source), canonicalize(t.target),
          1, now
        )
      );
      stmt.finalize((err) => (err ? reject(err) : resolve()));
    });
  });
}

function extractSnippet(content: string, source: string, target: string): string {
  const terms = [source, target].filter(Boolean);
  for (const term of terms) {
    const idx = content.toLowerCase().indexOf(term.toLowerCase());
    if (idx >= 0) {
      const start = Math.max(0, idx - 50);
      const end = Math.min(content.length, idx + 100);
      return content.slice(start, end).trim();
    }
  }
  return content.slice(0, 150).trim();
}

function upsertEvidence(
  db: Database,
  params: { relationId: number; noteId: number; snippet: string; sourceText: string }
): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO relation_evidence (relation_id, note_id, snippet, source_text)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(relation_id, note_id) DO UPDATE SET
         snippet = excluded.snippet,
         source_text = excluded.source_text`,
      [params.relationId, params.noteId, params.snippet, params.sourceText],
      (err) => (err ? reject(err) : resolve())
    );
  });
}

function saveEvidenceForNote(db: Database, noteId: number, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT id, source, target, canonical_source, canonical_target FROM concept_relations WHERE note_id = ?",
      [noteId],
      async (err, rows: any[]) => {
        if (err) return reject(err);
        try {
          for (const row of rows || []) {
            const src: string = row.canonical_source || row.source;
            const tgt: string = row.canonical_target || row.target;
            const snippet = extractSnippet(content, src, tgt);
            await upsertEvidence(db, { relationId: row.id, noteId, snippet, sourceText: "content" });
          }
          resolve();
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}

function getEvidenceForRelation(db: Database, relationId: number): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM relation_evidence WHERE relation_id = ?",
      [relationId],
      (err, rows) => (err ? reject(err) : resolve(rows || []))
    );
  });
}

function getRelationsForNote(db: Database, noteId: number): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT id FROM concept_relations WHERE note_id = ?",
      [noteId],
      (err, rows) => (err ? reject(err) : resolve(rows || []))
    );
  });
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("graph evidence flow", () => {
  beforeAll(() => {
    initDatabase(":memory:");
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("saveTriples(1 triple) then saveEvidenceForNote → relation_evidence has 1 row with non-empty snippet", async () => {
    const db = getDb()!;
    const note = await insertNote("alice knows bob in this story", "test", "", "text");

    await saveTriples(db, note.id, [{ source: "alice", relation: "knows", target: "bob" }]);
    await saveEvidenceForNote(db, note.id, note.content);

    const relRows = await getRelationsForNote(db, note.id);
    expect(relRows.length).toBe(1);

    const eviRows = await getEvidenceForRelation(db, relRows[0].id);
    expect(eviRows.length).toBe(1);
    expect(eviRows[0].snippet.length).toBeGreaterThan(0);
    expect(eviRows[0].source_text).toBe("content");
  });

  it("re-running saveEvidenceForNote for same triple → still 1 row (upsert)", async () => {
    const db = getDb()!;
    const note = await insertNote("bob meets charlie at the event", "test", "", "text");

    await saveTriples(db, note.id, [{ source: "bob", relation: "meets", target: "charlie" }]);
    await saveEvidenceForNote(db, note.id, note.content);
    await saveEvidenceForNote(db, note.id, note.content); // run again — must not duplicate

    const relRows = await getRelationsForNote(db, note.id);
    const eviRows = await getEvidenceForRelation(db, relRows[0].id);
    expect(eviRows.length).toBe(1); // upsert: still 1
  });
});
