import type sqlite3 from "sqlite3";
import type { Triple } from "../ai/extractTriples";
import { canonicalizeConcept } from "../utils/canonicalize";

export function saveTriples(db: sqlite3.Database, noteId: number, triples: Triple[]): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      db.serialize(() => {
        db.run("DELETE FROM concept_relations WHERE note_id = ?", [noteId]);
        const stmt = db.prepare(
          "INSERT INTO concept_relations (source, relation, target, note_id, canonical_source, canonical_target, support_count, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );
        const now = new Date().toISOString();
        triples.forEach((t) =>
          stmt.run(
            t.source, t.relation, t.target, noteId,
            canonicalizeConcept(t.source), canonicalizeConcept(t.target),
            1, now
          )
        );
        stmt.finalize((err) => {
          if (err) {
            console.error("[DB] saveTriples:error", err);
            return reject(err);
          }
          console.log(`[DB] saveTriples: ${triples.length} relations (note ${noteId})`);
          resolve();
        });
      });
    } catch (e) {
      console.error("[DB] saveTriples:error", e);
      reject(e);
    }
  });
}

// ── Relation Evidence ──────────────────────────────────────────────────────────

export interface EvidenceItem {
  noteId: string;
  title: string;
  snippet: string;
  createdAt: string;
}

export function upsertRelationEvidence(
  db: sqlite3.Database,
  params: {
    relationId: number;
    noteId: number;
    snippet: string;
    sourceText: string;
    start?: number | null;
    end?: number | null;
  }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const { relationId, noteId, snippet, sourceText, start = null, end = null } = params;
    db.run(
      `INSERT INTO relation_evidence
         (relation_id, note_id, snippet, source_text, source_offset_start, source_offset_end)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(relation_id, note_id) DO UPDATE SET
         snippet = excluded.snippet,
         source_text = excluded.source_text,
         source_offset_start = excluded.source_offset_start,
         source_offset_end = excluded.source_offset_end`,
      [relationId, noteId, snippet, sourceText, start, end],
      (err) => (err ? reject(err) : resolve())
    );
  });
}

export function getRelationEvidence(
  db: sqlite3.Database,
  params: { relationId: number; limit?: number }
): Promise<{ evidence: EvidenceItem[] }> {
  return new Promise((resolve, reject) => {
    const { relationId, limit = 5 } = params;
    db.all(
      `SELECT re.note_id, re.snippet, re.created_at,
              SUBSTR(COALESCE(NULLIF(n.summary, ''), n.content), 1, 30) AS title
       FROM relation_evidence re
       JOIN notes n ON re.note_id = n.id
       WHERE re.relation_id = ?
       ORDER BY re.created_at DESC
       LIMIT ?`,
      [relationId, limit],
      (err, rows: any[]) => {
        if (err) return reject(err);
        const evidence: EvidenceItem[] = (rows || []).map((r) => ({
          noteId: String(r.note_id),
          title: r.title || "",
          snippet: r.snippet || "",
          createdAt: r.created_at || "",
        }));
        resolve({ evidence });
      }
    );
  });
}

/** Extract a short snippet from content that contains source or target term. */
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

/**
 * After saveTriples, call this with the note content to write/update evidence rows.
 * Fetches content once; iterates all concept_relations for this note.
 */
export function saveEvidenceForNote(
  db: sqlite3.Database,
  noteId: number,
  content: string
): Promise<void> {
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
            console.log(`[EVIDENCE] relId=${row.id} noteId=${noteId} snippetLen=${snippet.length}`);
            await upsertRelationEvidence(db, {
              relationId: row.id,
              noteId,
              snippet,
              sourceText: "content",
            });
          }
          resolve();
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}
