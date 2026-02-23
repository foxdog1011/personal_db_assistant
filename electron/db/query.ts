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

// ── Sentence Picker ────────────────────────────────────────────────────────────

/**
 * Pick the best sentence from content that mentions source/target.
 * Confidence:
 *   0.9 → sentence contains both source and target
 *   0.6 → sentence contains one of the terms
 *   0.3 → fallback: first 150 chars of content
 */
export function pickBestSentence(
  content: string,
  source: string,
  target: string
): { sentence: string; confidence: number } {
  const sentences = content.split(/[.!?。！？\n]+/).map(s => s.trim()).filter(s => s.length > 0);
  const srcL = source.toLowerCase();
  const tgtL = target.toLowerCase();
  for (const s of sentences) {
    const sL = s.toLowerCase();
    if (sL.includes(srcL) && sL.includes(tgtL)) return { sentence: s, confidence: 0.9 };
  }
  for (const s of sentences) {
    const sL = s.toLowerCase();
    if (sL.includes(srcL) || sL.includes(tgtL)) return { sentence: s, confidence: 0.6 };
  }
  return { sentence: content.slice(0, 150).trim(), confidence: 0.3 };
}

// ── Relation Evidence ──────────────────────────────────────────────────────────

export interface EvidenceItem {
  noteId: string;
  title: string;
  snippet: string;
  createdAt: string;
  /** concept_relations.id — present in canonical query results */
  relationId?: string;
  /** Best matching sentence from note content */
  bestSentence?: string;
  /** Confidence score: 0.9 (both terms), 0.6 (one term), 0.3 (fallback) */
  confidence?: number;
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
    bestSentence?: string | null;
    confidence?: number | null;
  }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const {
      relationId, noteId, snippet, sourceText,
      start = null, end = null,
      bestSentence = null, confidence = null,
    } = params;
    db.run(
      `INSERT INTO relation_evidence
         (relation_id, note_id, snippet, source_text, source_offset_start, source_offset_end, best_sentence, confidence)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(relation_id, note_id) DO UPDATE SET
         snippet = excluded.snippet,
         source_text = excluded.source_text,
         source_offset_start = excluded.source_offset_start,
         source_offset_end = excluded.source_offset_end,
         best_sentence = excluded.best_sentence,
         confidence = excluded.confidence`,
      [relationId, noteId, snippet, sourceText, start, end, bestSentence, confidence],
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
      `SELECT re.note_id, re.snippet, re.created_at, re.best_sentence, re.confidence,
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
          bestSentence: r.best_sentence || undefined,
          confidence: r.confidence != null ? Number(r.confidence) : undefined,
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
 * Retrieve supporting evidence for a canonical edge pair (global mode).
 * Unions all relation_evidence rows whose concept_relation has the given
 * canonical_source + canonical_target (bidirectional) and optional relation filter.
 * Ordered by concept_relations.support_count DESC so strongest relations surface first.
 */
export function getCanonicalEdgeEvidence(
  db: sqlite3.Database,
  params: {
    canonicalSource: string;
    canonicalTarget: string;
    relation?: string;
    limit?: number;
  }
): Promise<{ evidence: EvidenceItem[] }> {
  return new Promise((resolve, reject) => {
    const { canonicalSource, canonicalTarget, relation, limit = 10 } = params;

    const whereParts: string[] = [
      `(
        (COALESCE(cr.canonical_source, cr.source) = ? AND COALESCE(cr.canonical_target, cr.target) = ?)
        OR
        (COALESCE(cr.canonical_source, cr.source) = ? AND COALESCE(cr.canonical_target, cr.target) = ?)
      )`,
    ];
    // A→B and B→A both covered
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
      SELECT re.note_id, re.snippet, re.created_at, re.best_sentence, re.confidence,
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
      const evidence: EvidenceItem[] = (rows || []).map((r) => ({
        noteId: String(r.note_id),
        title: r.title || "",
        snippet: r.snippet || "",
        createdAt: r.created_at || "",
        relationId: String(r.relationId),
        bestSentence: r.best_sentence || undefined,
        confidence: r.confidence != null ? Number(r.confidence) : undefined,
      }));
      resolve({ evidence });
    });
  });
}

/**
 * After saveTriples, call this with the note content to write/update evidence rows.
 * Computes pickBestSentence for each relation and stores with the upsert.
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
            const { sentence: bestSentence, confidence } = pickBestSentence(content, src, tgt);
            console.log(`[EVIDENCE] relId=${row.id} noteId=${noteId} snippetLen=${snippet.length} confidence=${confidence}`);
            await upsertRelationEvidence(db, {
              relationId: row.id,
              noteId,
              snippet,
              sourceText: "content",
              bestSentence,
              confidence,
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
