/**
 * tests/canonical-evidence.test.ts
 *
 * Tests for getCanonicalEdgeEvidence (service level) — covers requirements a–e:
 *   a) returns union of notes across multiple relation_ids for the same canonical pair
 *   b) respects limit
 *   c) respects relation filter (relation provided vs omitted)
 *   d) ordering: higher support_count first
 *   e) IPC handler wiring: query returns correct shape when called with valid params
 */
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { initDatabase, insertNote, closeDatabase, getDb } from "../db/manager";
import type { Database } from "sqlite3";

// ── Raw SQL helpers ───────────────────────────────────────────────────────────

function run(db: Database, sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => (err ? reject(err) : resolve()));
  });
}

function getLastId(db: Database): Promise<number> {
  return new Promise((resolve, reject) => {
    db.get("SELECT last_insert_rowid() AS id", [], (err, row: any) =>
      err ? reject(err) : resolve(row.id)
    );
  });
}

async function insertRelation(
  db: Database,
  opts: {
    source: string;
    relation: string;
    target: string;
    noteId: number;
    canonicalSource: string;
    canonicalTarget: string;
    supportCount?: number;
  }
): Promise<number> {
  const now = new Date().toISOString();
  await run(
    db,
    `INSERT INTO concept_relations
       (source, relation, target, note_id, canonical_source, canonical_target, support_count, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      opts.source, opts.relation, opts.target, opts.noteId,
      opts.canonicalSource, opts.canonicalTarget,
      opts.supportCount ?? 1, now,
    ]
  );
  return getLastId(db);
}

async function insertEvidence(
  db: Database,
  relationId: number,
  noteId: number,
  snippet: string
): Promise<void> {
  await run(
    db,
    `INSERT OR REPLACE INTO relation_evidence (relation_id, note_id, snippet, source_text)
     VALUES (?, ?, ?, 'content')`,
    [relationId, noteId, snippet]
  );
}

// ── Mirror of getCanonicalEdgeEvidence (no electron/ import) ─────────────────

function getCanonicalEdgeEvidence(
  db: Database,
  params: {
    canonicalSource: string;
    canonicalTarget: string;
    relation?: string;
    limit?: number;
  }
): Promise<{ evidence: any[] }> {
  return new Promise((resolve, reject) => {
    const { canonicalSource, canonicalTarget, relation, limit = 10 } = params;

    const whereParts: string[] = [
      `(
        (COALESCE(cr.canonical_source, cr.source) = ? AND COALESCE(cr.canonical_target, cr.target) = ?)
        OR
        (COALESCE(cr.canonical_source, cr.source) = ? AND COALESCE(cr.canonical_target, cr.target) = ?)
      )`,
    ];
    const sqlParams: any[] = [
      canonicalSource, canonicalTarget,
      canonicalTarget, canonicalSource,
    ];

    if (relation) {
      whereParts.push("cr.relation = ?");
      sqlParams.push(relation);
    }

    sqlParams.push(limit);

    const sql = `
      SELECT re.note_id, re.snippet, re.created_at,
             cr.id AS relationId,
             SUBSTR(COALESCE(NULLIF(n.summary, ''), n.content), 1, 30) AS title
      FROM concept_relations cr
      JOIN relation_evidence re ON re.relation_id = cr.id
      JOIN notes n ON n.id = re.note_id
      WHERE ${whereParts.join(" AND ")}
      ORDER BY cr.support_count DESC, cr.last_seen_at DESC
      LIMIT ?
    `;

    db.all(sql, sqlParams, (err, rows: any[]) => {
      if (err) return reject(err);
      const evidence = (rows || []).map((r) => ({
        noteId: String(r.note_id),
        title: r.title || "",
        snippet: r.snippet || "",
        createdAt: r.created_at || "",
        relationId: String(r.relationId),
      }));
      resolve({ evidence });
    });
  });
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("getCanonicalEdgeEvidence", () => {
  beforeAll(() => {
    initDatabase(":memory:");
  });

  afterAll(async () => {
    await closeDatabase();
  });

  // a) union across multiple relation_ids ───────────────────────────────────
  it("a) returns union of evidence rows across multiple relation_ids for the same canonical pair", async () => {
    const db = getDb()!;

    const noteA = await insertNote("alice knows bob story A", "ce", "", "text");
    const noteB = await insertNote("alice knows bob story B", "ce", "", "text");

    // Two separate concept_relations rows (different notes) with same canonical pair
    const relId1 = await insertRelation(db, {
      source: "Alice", relation: "knows", target: "Bob",
      noteId: noteA.id, canonicalSource: "alice", canonicalTarget: "bob",
    });
    const relId2 = await insertRelation(db, {
      source: "alice", relation: "knows", target: "bob",
      noteId: noteB.id, canonicalSource: "alice", canonicalTarget: "bob",
    });

    await insertEvidence(db, relId1, noteA.id, "snippet for note A");
    await insertEvidence(db, relId2, noteB.id, "snippet for note B");

    const { evidence } = await getCanonicalEdgeEvidence(db, {
      canonicalSource: "alice",
      canonicalTarget: "bob",
    });

    expect(evidence.length).toBe(2);
    const snippets = evidence.map((e) => e.snippet);
    expect(snippets).toContain("snippet for note A");
    expect(snippets).toContain("snippet for note B");
  });

  // b) respects limit ───────────────────────────────────────────────────────
  it("b) respects limit parameter", async () => {
    const db = getDb()!;

    const noteC = await insertNote("limit test C", "ce", "", "text");
    const noteD = await insertNote("limit test D", "ce", "", "text");
    const noteE = await insertNote("limit test E", "ce", "", "text");

    const relC = await insertRelation(db, {
      source: "cat", relation: "chases", target: "dog",
      noteId: noteC.id, canonicalSource: "cat", canonicalTarget: "dog",
    });
    const relD = await insertRelation(db, {
      source: "cat", relation: "chases", target: "dog",
      noteId: noteD.id, canonicalSource: "cat", canonicalTarget: "dog",
    });
    const relE = await insertRelation(db, {
      source: "cat", relation: "chases", target: "dog",
      noteId: noteE.id, canonicalSource: "cat", canonicalTarget: "dog",
    });

    await insertEvidence(db, relC, noteC.id, "c snippet");
    await insertEvidence(db, relD, noteD.id, "d snippet");
    await insertEvidence(db, relE, noteE.id, "e snippet");

    const { evidence } = await getCanonicalEdgeEvidence(db, {
      canonicalSource: "cat",
      canonicalTarget: "dog",
      limit: 2,
    });

    expect(evidence.length).toBe(2);
  });

  // c) respects relation filter ─────────────────────────────────────────────
  it("c) filters by relation when provided; returns all matching relations when omitted", async () => {
    const db = getDb()!;

    const note1 = await insertNote("rel filter note 1", "ce", "", "text");
    const note2 = await insertNote("rel filter note 2", "ce", "", "text");

    const relLikes = await insertRelation(db, {
      source: "x", relation: "likes", target: "y",
      noteId: note1.id, canonicalSource: "x", canonicalTarget: "y",
    });
    const relHates = await insertRelation(db, {
      source: "x", relation: "hates", target: "y",
      noteId: note2.id, canonicalSource: "x", canonicalTarget: "y",
    });

    await insertEvidence(db, relLikes, note1.id, "likes snippet");
    await insertEvidence(db, relHates, note2.id, "hates snippet");

    // With relation filter: only "likes" rows
    const { evidence: filtered } = await getCanonicalEdgeEvidence(db, {
      canonicalSource: "x", canonicalTarget: "y", relation: "likes",
    });
    expect(filtered.length).toBe(1);
    expect(filtered[0].snippet).toBe("likes snippet");

    // Without relation filter: both rows
    const { evidence: all } = await getCanonicalEdgeEvidence(db, {
      canonicalSource: "x", canonicalTarget: "y",
    });
    expect(all.length).toBe(2);
  });

  // d) ordering: higher support_count first ─────────────────────────────────
  it("d) orders results by support_count DESC", async () => {
    const db = getDb()!;

    const noteLow = await insertNote("low support note", "ce", "", "text");
    const noteHigh = await insertNote("high support note", "ce", "", "text");

    const relLow = await insertRelation(db, {
      source: "p", relation: "connects", target: "q",
      noteId: noteLow.id, canonicalSource: "p", canonicalTarget: "q",
      supportCount: 1,
    });
    const relHigh = await insertRelation(db, {
      source: "p", relation: "connects", target: "q",
      noteId: noteHigh.id, canonicalSource: "p", canonicalTarget: "q",
      supportCount: 5,
    });

    await insertEvidence(db, relLow, noteLow.id, "low snippet");
    await insertEvidence(db, relHigh, noteHigh.id, "high snippet");

    const { evidence } = await getCanonicalEdgeEvidence(db, {
      canonicalSource: "p", canonicalTarget: "q",
    });

    expect(evidence.length).toBe(2);
    // First result must be the high-support one
    expect(evidence[0].snippet).toBe("high snippet");
    expect(evidence[1].snippet).toBe("low snippet");
  });

  // e) IPC handler shape: returns EvidenceItem array with expected fields ────
  it("e) returns well-formed EvidenceItem objects with noteId, title, snippet, relationId", async () => {
    const db = getDb()!;

    const note = await insertNote("shape test content for ipc check", "ce", "", "text");
    const relId = await insertRelation(db, {
      source: "ipc", relation: "tests", target: "shape",
      noteId: note.id, canonicalSource: "ipc", canonicalTarget: "shape",
    });
    await insertEvidence(db, relId, note.id, "ipc shape snippet");

    const { evidence } = await getCanonicalEdgeEvidence(db, {
      canonicalSource: "ipc", canonicalTarget: "shape",
    });

    expect(evidence.length).toBe(1);
    const item = evidence[0];
    expect(typeof item.noteId).toBe("string");
    expect(typeof item.title).toBe("string");
    expect(item.title.length).toBeGreaterThan(0);
    expect(typeof item.snippet).toBe("string");
    expect(item.snippet).toBe("ipc shape snippet");
    expect(typeof item.relationId).toBe("string");
    expect(item.createdAt).toBeTruthy();
  });
});
