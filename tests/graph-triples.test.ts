import { describe, it, beforeAll, afterAll, expect } from "vitest";
import {
  initDatabase,
  insertNote,
  closeDatabase,
  getDb,
} from "../db/manager";

/**
 * Local mirror of electron/utils/canonicalize.ts — kept in sync manually.
 * Do NOT import from electron/ to avoid process.type issues in vitest.
 */
function canonicalizeConcept(input: string): string {
  let s = (input ?? "").trim();
  if (!s) return "";
  if (s.normalize) s = s.normalize("NFKC");
  s = s.toLowerCase();
  s = s.replace(/\s+/g, " ");
  s = s.replace(/^[\s\.,:;()\[\]{}"'`，。！？!？]+/, "");
  s = s.replace(/[\s\.,:;()\[\]{}"'`，。！？!？]+$/, "");
  return s;
}

/* Alias used by saveTriples helper below */
const canonicalize = canonicalizeConcept;

/**
 * Mirrors saveTriples from electron/db/query.ts but works on the
 * test in-memory DB without requiring Electron imports.
 */
function saveTriples(
  db: import("sqlite3").Database,
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

function getKnowledgeGraph(db: import("sqlite3").Database): Promise<{
  nodes: { id: string; label: string }[];
  links: { source: string; target: string; label: string }[];
}> {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT c.* FROM concept_relations c JOIN notes n ON c.note_id = n.id`,
      [],
      (err, rows: any[]) => {
        if (err) return reject(err);
        const nodesMap = new Map<string, { id: string; label: string }>();
        const links: { source: string; target: string; label: string }[] = [];
        (rows || []).forEach((r) => {
          nodesMap.set(r.source, { id: r.source, label: r.source });
          nodesMap.set(r.target, { id: r.target, label: r.target });
          links.push({ source: r.source, target: r.target, label: r.relation });
        });
        resolve({ nodes: Array.from(nodesMap.values()), links });
      }
    );
  });
}

function countTriples(
  db: import("sqlite3").Database,
  noteId: number
): Promise<number> {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT COUNT(*) AS cnt FROM concept_relations WHERE note_id = ?",
      [noteId],
      (err, row: any) => (err ? reject(err) : resolve(row?.cnt ?? 0))
    );
  });
}

describe("graph triples end-to-end", () => {
  beforeAll(() => {
    initDatabase(":memory:");
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("saveTriples writes to concept_relations and getKnowledgeGraph returns non-empty", async () => {
    const db = getDb()!;
    const note = await insertNote("AI 需要大量資料來訓練模型", "ai,ml", "", "text");

    // Simulate what MOCK_OPENAI=1 extractTriples returns
    const mockTriples = [{ source: "mock", relation: "test", target: "note" }];
    await saveTriples(db, note.id, mockTriples);

    // Verify DB has the triple
    const cnt = await countTriples(db, note.id);
    expect(cnt).toBe(1);

    // Verify getKnowledgeGraph returns nodes and links
    const graph = await getKnowledgeGraph(db);
    expect(graph.nodes.length).toBeGreaterThanOrEqual(2); // "mock" and "note"
    expect(graph.links.length).toBeGreaterThanOrEqual(1);
    expect(graph.links[0].source).toBe("mock");
    expect(graph.links[0].target).toBe("note");
    expect(graph.links[0].label).toBe("test");
  });

  it("saveTriples replaces old triples for same note", async () => {
    const db = getDb()!;
    const note = await insertNote("更新測試", "test", "", "text");

    await saveTriples(db, note.id, [
      { source: "A", relation: "r1", target: "B" },
      { source: "C", relation: "r2", target: "D" },
    ]);
    expect(await countTriples(db, note.id)).toBe(2);

    // Replace with new triples
    await saveTriples(db, note.id, [
      { source: "X", relation: "r3", target: "Y" },
    ]);
    expect(await countTriples(db, note.id)).toBe(1);
  });

  /* ====================================================
   * Regression tests for schema enhancement
   * ==================================================== */

  it("saveTriples stores canonical_source/canonical_target via canonicalizeConcept", async () => {
    const db = getDb()!;
    const note = await insertNote("Canonical test", "test", "", "text");
    // "(Alice!)" → strips parens+!, lowercase → "alice"
    // "  BOB  " → trim+lowercase → "bob"
    await saveTriples(db, note.id, [{ source: "(Alice!)", relation: "knows", target: "  BOB  " }]);

    const row = await new Promise<any>((resolve, reject) => {
      db.get(
        "SELECT canonical_source, canonical_target FROM concept_relations WHERE note_id = ?",
        [note.id],
        (err, r) => (err ? reject(err) : resolve(r))
      );
    });
    expect(row.canonical_source).toBe("alice");
    expect(row.canonical_target).toBe("bob");
  });

  it("note mode depth=1 SQL returns only direct note triples", async () => {
    const db = getDb()!;
    const noteA = await insertNote("Ego A", "ego", "", "text");
    const noteB = await insertNote("Ego B", "ego", "", "text");

    await saveTriples(db, noteA.id, [{ source: "ego_x", relation: "r1", target: "ego_y" }]);
    await saveTriples(db, noteB.id, [{ source: "ego_y", relation: "r2", target: "ego_z" }]);

    const rows = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT c.* FROM concept_relations c JOIN notes n ON c.note_id = n.id WHERE c.note_id = ?`,
        [noteA.id],
        (err, r) => (err ? reject(err) : resolve(r))
      );
    });
    expect(rows.length).toBe(1);
    expect(rows[0].source).toBe("ego_x");
  });

  it("note mode depth=2 CTE includes 2-hop neighbors via canonical terms", async () => {
    const db = getDb()!;
    const noteA = await insertNote("D2 A", "d2", "", "text");
    const noteB = await insertNote("D2 B", "d2", "", "text");

    await saveTriples(db, noteA.id, [{ source: "Concept", relation: "has", target: "Feature" }]);
    await saveTriples(db, noteB.id, [{ source: "Feature", relation: "enables", target: "Value" }]);

    // depth=2 CTE query (mirrors what IPC handler executes)
    const sql = `
      WITH d1 AS (
        SELECT COALESCE(canonical_source, source) AS cs,
               COALESCE(canonical_target, target) AS ct
        FROM concept_relations WHERE note_id = ?
      ),
      d1_terms AS (
        SELECT cs AS term FROM d1
        UNION SELECT ct FROM d1
      )
      SELECT c.* FROM concept_relations c JOIN notes n ON c.note_id = n.id
      WHERE COALESCE(c.canonical_source, c.source) IN (SELECT term FROM d1_terms)
         OR COALESCE(c.canonical_target, c.target) IN (SELECT term FROM d1_terms)
      LIMIT 200
    `;
    const rows = await new Promise<any[]>((resolve, reject) => {
      db.all(sql, [noteA.id], (err, r) => (err ? reject(err) : resolve(r)));
    });
    // Should include both noteA's triple ("concept"→"feature") and noteB's ("feature"→"value")
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const sources = rows.map((r) => r.canonical_source);
    expect(sources).toContain("concept");
    expect(sources).toContain("feature");
  });

  it("global mode aggregation: minSupportingNotes=2 only returns triples shared by 2+ notes", async () => {
    const db = getDb()!;
    const noteX = await insertNote("WtX", "wt", "", "text");
    const noteY = await insertNote("WtY", "wt", "", "text");

    // Both notes share "wt_src → wt_tgt" (support=2)
    await saveTriples(db, noteX.id, [{ source: "wt_src", relation: "wt_rel", target: "wt_tgt" }]);
    await saveTriples(db, noteY.id, [
      { source: "wt_src", relation: "wt_rel", target: "wt_tgt" },   // same → support=2
      { source: "wt_unique", relation: "wt_rel", target: "wt_tgt2" }, // unique → support=1
    ]);

    const aggRows = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT COALESCE(canonical_source, source) AS cs,
                COALESCE(canonical_target, target) AS ct,
                relation,
                COUNT(DISTINCT note_id) AS agg_support
         FROM concept_relations c JOIN notes n ON c.note_id = n.id
         GROUP BY cs, ct, relation
         HAVING agg_support >= ?
         ORDER BY agg_support DESC LIMIT 200`,
        [2],
        (err, r) => (err ? reject(err) : resolve(r))
      );
    });

    const supported = aggRows.find((r) => r.cs === "wt_src" && r.ct === "wt_tgt");
    expect(supported).toBeDefined();
    expect(Number(supported.agg_support)).toBeGreaterThanOrEqual(2);

    const unique = aggRows.find((r) => r.cs === "wt_unique");
    expect(unique).toBeUndefined();
  });

  it("getKnowledgeGraph excludes orphan triples (no matching note)", async () => {
    const db = getDb()!;

    // Insert a triple with a non-existent note_id
    await new Promise<void>((resolve, reject) => {
      db.run(
        "INSERT INTO concept_relations (source, relation, target, note_id) VALUES (?, ?, ?, ?)",
        ["orphan_src", "orphan_rel", "orphan_tgt", 99999],
        (err) => (err ? reject(err) : resolve())
      );
    });

    const graph = await getKnowledgeGraph(db);
    // Orphan triple should NOT appear (JOIN notes filters it out)
    const orphanLink = graph.links.find((l) => l.source === "orphan_src");
    expect(orphanLink).toBeUndefined();
  });

  it("note mode: minSupportCount filters rows by support_count column", async () => {
    const db = getDb()!;
    const note = await insertNote("SupportCount test", "sc", "", "text");
    await saveTriples(db, note.id, [{ source: "sc_src", relation: "sc_rel", target: "sc_tgt" }]);

    // Bump support_count to 2 to simulate reinforced triple
    await new Promise<void>((resolve, reject) => {
      db.run(
        "UPDATE concept_relations SET support_count = 2 WHERE note_id = ?",
        [note.id],
        (err) => (err ? reject(err) : resolve())
      );
    });

    const query = (minSC: number) =>
      new Promise<any[]>((resolve, reject) => {
        db.all(
          `SELECT c.* FROM concept_relations c JOIN notes n ON c.note_id = n.id
           WHERE c.note_id = ? AND c.support_count >= ? LIMIT 200`,
          [note.id, minSC],
          (err, rows) => (err ? reject(err) : resolve(rows))
        );
      });

    expect((await query(1)).length).toBe(1); // support_count=2 >= 1
    expect((await query(2)).length).toBe(1); // support_count=2 >= 2
    expect((await query(3)).length).toBe(0); // support_count=2 < 3
  });
});

/* ====================================================
 * canonicalizeConcept unit tests
 * ==================================================== */
describe("canonicalizeConcept util", () => {
  it("trims whitespace and lowercases", () => {
    expect(canonicalizeConcept("  Alice  ")).toBe("alice");
    expect(canonicalizeConcept("BOB")).toBe("bob");
  });

  it("returns empty string for empty or whitespace-only input", () => {
    expect(canonicalizeConcept("")).toBe("");
    expect(canonicalizeConcept("   ")).toBe("");
  });

  it("strips leading punctuation", () => {
    expect(canonicalizeConcept("(hello)")).toBe("hello");
    expect(canonicalizeConcept("。世界。")).toBe("世界");
  });

  it("strips trailing punctuation and exclamation marks", () => {
    expect(canonicalizeConcept("hello!")).toBe("hello");
    expect(canonicalizeConcept("(Alice!)")).toBe("alice");
  });

  it("collapses internal whitespace to a single space", () => {
    expect(canonicalizeConcept("hello   world")).toBe("hello world");
  });

  it("NFKC normalizes fullwidth characters to ASCII", () => {
    expect(canonicalizeConcept("ＡＩ")).toBe("ai");
  });
});
