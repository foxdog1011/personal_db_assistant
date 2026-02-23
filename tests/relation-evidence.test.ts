/**
 * tests/relation-evidence.test.ts
 *
 * E1 tests (3):
 *   1. insert evidence → can read back
 *   2. same (relation_id, note_id) upsert does not create duplicate
 *   3. limit is respected
 */
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { initDatabase, insertNote, closeDatabase, getDb } from "../db/manager";
import type { Database } from "sqlite3";

// ── Raw SQL helpers (mirror electron/db/query.ts without Electron imports) ───

function upsertEvidence(
  db: Database,
  params: {
    relationId: number;
    noteId: number;
    snippet: string;
    sourceText: string;
    bestSentence?: string | null;
    confidence?: number | null;
  }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const { relationId, noteId, snippet, sourceText,
            bestSentence = null, confidence = null } = params;
    db.run(
      `INSERT INTO relation_evidence
         (relation_id, note_id, snippet, source_text, best_sentence, confidence)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(relation_id, note_id) DO UPDATE SET
         snippet = excluded.snippet,
         source_text = excluded.source_text,
         best_sentence = excluded.best_sentence,
         confidence = excluded.confidence`,
      [relationId, noteId, snippet, sourceText, bestSentence, confidence],
      (err) => (err ? reject(err) : resolve())
    );
  });
}

function getEvidence(
  db: Database,
  params: { relationId: number; limit?: number }
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT re.*, SUBSTR(COALESCE(NULLIF(n.summary, ''), n.content), 1, 30) AS title
       FROM relation_evidence re JOIN notes n ON re.note_id = n.id
       WHERE re.relation_id = ? ORDER BY re.created_at DESC LIMIT ?`,
      [params.relationId, params.limit ?? 5],
      (err, rows) => (err ? reject(err) : resolve(rows || []))
    );
  });
}

function insertRelation(
  db: Database,
  noteId: number
): Promise<number> {
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO concept_relations (source, relation, target, note_id) VALUES (?, ?, ?, ?)",
      ["src", "rel", "tgt", noteId],
      function (err) { err ? reject(err) : resolve(this.lastID); }
    );
  });
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("relation_evidence", () => {
  beforeAll(() => {
    initDatabase(":memory:");
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("insert evidence → can read back with non-empty title and snippet", async () => {
    const db = getDb()!;
    const note = await insertNote("alice knows bob in this story", "test", "", "text");
    const relId = await insertRelation(db, note.id);

    await upsertEvidence(db, {
      relationId: relId,
      noteId: note.id,
      snippet: "alice knows bob in this story",
      sourceText: "content",
    });

    const rows = await getEvidence(db, { relationId: relId });
    expect(rows.length).toBe(1);
    expect(rows[0].snippet).toBe("alice knows bob in this story");
    expect(rows[0].title).toBeTruthy(); // SUBSTR of content
  });

  it("same (relation_id, note_id) upsert does not create a duplicate row", async () => {
    const db = getDb()!;
    const note = await insertNote("upsert test content", "test", "", "text");
    const relId = await insertRelation(db, note.id);

    await upsertEvidence(db, { relationId: relId, noteId: note.id, snippet: "first", sourceText: "content" });
    await upsertEvidence(db, { relationId: relId, noteId: note.id, snippet: "second", sourceText: "content" });

    const rows = await getEvidence(db, { relationId: relId });
    expect(rows.length).toBe(1);
    expect(rows[0].snippet).toBe("second"); // updated value
  });

  it("limit is respected", async () => {
    const db = getDb()!;

    // Insert a shared relation
    const note1 = await insertNote("limit note 1", "", "", "text");
    const relId = await insertRelation(db, note1.id);

    // Insert 3 evidence rows with different note_ids (each note has its own unique constraint slot)
    const note2 = await insertNote("limit note 2", "", "", "text");
    const note3 = await insertNote("limit note 3", "", "", "text");

    await upsertEvidence(db, { relationId: relId, noteId: note1.id, snippet: "s1", sourceText: "content" });
    await upsertEvidence(db, { relationId: relId, noteId: note2.id, snippet: "s2", sourceText: "content" });
    await upsertEvidence(db, { relationId: relId, noteId: note3.id, snippet: "s3", sourceText: "content" });

    const rows = await getEvidence(db, { relationId: relId, limit: 2 });
    expect(rows.length).toBe(2);
  });

  // Test 4 ─────────────────────────────────────────────────────────────────────
  it("4) upsert updates best_sentence and confidence in place (no duplicate row)", async () => {
    const db = getDb()!;
    const note = await insertNote("alice knows bob in this story", "test", "", "text");
    const relId = await insertRelation(db, note.id);

    await upsertEvidence(db, {
      relationId: relId,
      noteId: note.id,
      snippet: "first snippet",
      sourceText: "content",
      bestSentence: "alice meets bob here",
      confidence: 0.9,
    });

    // Upsert again — should update in place, not insert a new row
    await upsertEvidence(db, {
      relationId: relId,
      noteId: note.id,
      snippet: "second snippet",
      sourceText: "content",
      bestSentence: "alice and bob are friends",
      confidence: 0.6,
    });

    const rows = await getEvidence(db, { relationId: relId });
    expect(rows.length).toBe(1);
    expect(rows[0].snippet).toBe("second snippet");
    expect(rows[0].best_sentence).toBe("alice and bob are friends");
    expect(rows[0].confidence).toBe(0.6);
  });
});
