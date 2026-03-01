/**
 * Tests for getRelatedNotes (concept-based recommendation).
 * Uses in-memory SQLite via db/manager — no Electron, no OpenAI.
 */
import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import { initDatabase, closeDatabase, getDb, insertNote } from "../db/manager";
import { getRelatedNotes } from "../electron/services/related_notes";

function run(db: import("sqlite3").Database, sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => (err ? reject(err) : resolve()));
  });
}

/** Insert a concept_relations row directly. */
function insertRelation(
  db: import("sqlite3").Database,
  noteId: number,
  csrc: string,
  ctgt: string,
  supportCount = 1
): Promise<void> {
  return run(db, `
    INSERT INTO concept_relations
      (source, relation, target, note_id, canonical_source, canonical_target, support_count, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [csrc, "rel", ctgt, noteId, csrc, ctgt, supportCount, new Date().toISOString()]
  );
}

describe("getRelatedNotes (concept-based)", () => {
  beforeAll(() => {
    initDatabase(":memory:");
  });

  afterAll(async () => {
    await closeDatabase();
  });

  beforeEach(async () => {
    // Wipe concept_relations between tests; notes accumulate (IDs auto-increment)
    const db = getDb()!;
    await run(db, "DELETE FROM concept_relations");
  });

  // ── Test 1 ──────────────────────────────────────────────────────────────────
  it("returns [] when note has no concept_relations", async () => {
    const db = getDb()!;
    const note = await insertNote("orphan note", "", "", "text");
    const result = await getRelatedNotes(db, { noteId: note.id.toString() });
    expect(result).toEqual([]);
  });

  // ── Test 2 ──────────────────────────────────────────────────────────────────
  it("recommends notes that share a canonical term", async () => {
    const db = getDb()!;
    const noteA = await insertNote("note A", "", "", "text");
    const noteB = await insertNote("note B", "", "", "text");

    // noteA: alice → bob
    await insertRelation(db, noteA.id, "alice", "bob");
    // noteB: alice → carol  (shares canonical_source "alice" with noteA)
    await insertRelation(db, noteB.id, "alice", "carol");

    const result = await getRelatedNotes(db, { noteId: noteA.id.toString() });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].noteId).toBe(noteB.id.toString());
    expect(result[0].sharedTerms).toContain("alice");
    expect(result[0].sharedCount).toBeGreaterThanOrEqual(1);
  });

  // ── Test 3 ──────────────────────────────────────────────────────────────────
  it("ranks candidates by descending score (sum of support_count)", async () => {
    const db = getDb()!;
    const anchor = await insertNote("anchor note", "", "", "text");
    const noteHigh = await insertNote("high-support note", "", "", "text");
    const noteLow = await insertNote("low-support note", "", "", "text");

    // anchor shares "alice" with both noteHigh and noteLow
    await insertRelation(db, anchor.id, "alice", "x");

    // noteHigh contributes support_count=5 for "alice"
    await insertRelation(db, noteHigh.id, "alice", "z", 5);
    // noteLow contributes support_count=1 for "alice"
    await insertRelation(db, noteLow.id, "alice", "w", 1);

    const result = await getRelatedNotes(db, { noteId: anchor.id.toString() });
    expect(result.length).toBeGreaterThanOrEqual(2);
    // noteHigh should rank first (score 5 > 1)
    expect(result[0].noteId).toBe(noteHigh.id.toString());
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  // ── Test 4 ──────────────────────────────────────────────────────────────────
  it("respects k limit", async () => {
    const db = getDb()!;
    const anchor = await insertNote("anchor k-test", "", "", "text");

    // Create 6 candidates all sharing "shared-term"
    for (let i = 0; i < 6; i++) {
      const n = await insertNote(`candidate-k-${i}`, "", "", "text");
      await insertRelation(db, anchor.id, "shared-term", `anchor-side-${i}`);
      await insertRelation(db, n.id, "shared-term", `cand-side-${i}`);
    }

    const result = await getRelatedNotes(db, { noteId: anchor.id.toString(), k: 3 });
    expect(result.length).toBeLessThanOrEqual(3);
  });
});
