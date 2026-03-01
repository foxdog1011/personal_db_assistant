/**
 * Hybrid semantic similarity for note recommendations.
 *
 * MOCK_OPENAI=1  → token-overlap scoring (no network required)
 * else           → cosine similarity on stored embeddings, fallback to overlap
 *                  when embeddings are missing.
 */
import type sqlite3 from "sqlite3";

export interface SemanticNote {
  noteId: string;
  title: string;
  score: number; // 0.0–1.0 (cosine) or 0.0–1.0 (overlap)
}

// ── helpers ──────────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  let s = (text || "").normalize("NFKC").toLowerCase();
  s = s.replace(/[\s.,;:()[\]{}"'`，。！？!？、…—\-]+/g, " ").trim();
  return s.split(/\s+/).filter(Boolean);
}

function overlapScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const overlap = b.filter((t) => setA.has(t)).length;
  return overlap / Math.sqrt(a.length * b.length);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function dbGet<T = any>(
  db: sqlite3.Database,
  sql: string,
  params: any[] = []
): Promise<T | undefined> {
  return new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row as T | undefined)))
  );
}

function dbAll<T = any>(
  db: sqlite3.Database,
  sql: string,
  params: any[] = []
): Promise<T[]> {
  return new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) =>
      err ? reject(err) : resolve((rows || []) as T[])
    )
  );
}

// ── main export ───────────────────────────────────────────────────────────────

export interface GetSemanticNotesParams {
  noteId: string;
  k?: number;
}

export async function getSemanticNotes(
  db: sqlite3.Database,
  params: GetSemanticNotesParams
): Promise<{ related: SemanticNote[] }> {
  const { noteId, k = 5 } = params;
  const noteIdNum = parseInt(noteId, 10);
  if (isNaN(noteIdNum)) return { related: [] };

  const isMock = process.env.MOCK_OPENAI === "1";

  // Step 1: base note content
  const base = await dbGet<{ content: string; summary: string | null }>(
    db,
    "SELECT content, summary FROM notes WHERE id = ?",
    [noteIdNum]
  );
  if (!base) return { related: [] };

  const baseText = base.summary || base.content;

  // Step 2: candidate notes (exclude self, cap 200)
  const candidates = await dbAll<{
    id: number;
    content: string;
    summary: string | null;
  }>(db, "SELECT id, content, summary FROM notes WHERE id != ? LIMIT 200", [
    noteIdNum,
  ]);

  if (candidates.length === 0) return { related: [] };

  let method: "cosine" | "overlap" = "overlap";
  let scored: Array<{ id: number; score: number; title: string }>;

  if (!isMock) {
    // Step 3 (real): try cosine similarity from embeddings table
    const embRows = await dbAll<{ note_id: number; vector: string }>(
      db,
      "SELECT note_id, vector FROM embeddings"
    ).catch(() => [] as { note_id: number; vector: string }[]);

    const embMap = new Map<number, number[]>();
    for (const row of embRows) {
      try {
        embMap.set(row.note_id, JSON.parse(row.vector));
      } catch {
        // skip malformed rows
      }
    }

    const baseVec = embMap.get(noteIdNum);
    if (baseVec && baseVec.length > 0) {
      method = "cosine";
      const baseTokens = tokenize(baseText); // for fallback
      scored = candidates.map((c) => {
        const vec = embMap.get(c.id);
        const score = vec
          ? cosineSimilarity(baseVec, vec)
          : overlapScore(baseTokens, tokenize(c.summary || c.content));
        return {
          id: c.id,
          score,
          title: (c.summary || c.content).slice(0, 30),
        };
      });
    } else {
      // fallback: no embedding for base note
      const baseTokens = tokenize(baseText);
      scored = candidates.map((c) => ({
        id: c.id,
        score: overlapScore(baseTokens, tokenize(c.summary || c.content)),
        title: (c.summary || c.content).slice(0, 30),
      }));
    }
  } else {
    // Step 3 (mock): overlap tokenization
    const baseTokens = tokenize(baseText);
    scored = candidates.map((c) => ({
      id: c.id,
      score: overlapScore(baseTokens, tokenize(c.summary || c.content)),
      title: (c.summary || c.content).slice(0, 30),
    }));
  }

  const result = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((r) => ({
      noteId: r.id.toString(),
      title: r.title,
      score: Math.round(r.score * 1000) / 1000,
    }));

  console.log(
    `[SEMANTIC] noteId=${noteIdNum} method=${method} candidates=${candidates.length} returned=${result.length}`
  );

  return { related: result };
}
