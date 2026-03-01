import type sqlite3 from "sqlite3";

export interface RelatedNote {
  noteId: string;
  title: string;
  score: number;        // sum of support_count across shared canonical terms
  sharedTerms: string[];
  sharedCount: number;  // total distinct shared terms (before maxSharedTermsShown slice)
}

export interface GetRelatedNotesParams {
  noteId: string;
  k?: number;
  minScore?: number;
  maxSharedTermsShown?: number;
}

function dbAll<T = any>(
  db: sqlite3.Database,
  sql: string,
  params: any[] = []
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve((rows || []) as T[]);
    });
  });
}

export async function getRelatedNotes(
  db: sqlite3.Database,
  params: GetRelatedNotesParams
): Promise<RelatedNote[]> {
  const { noteId, k = 5, minScore = 1, maxSharedTermsShown = 5 } = params;
  const noteIdNum = parseInt(noteId, 10);
  if (isNaN(noteIdNum)) return [];

  // Step 1: collect distinct canonical terms for this note (cap at 50)
  const baseTermRows = await dbAll<{ term: string }>(
    db,
    `SELECT DISTINCT canonical_source AS term FROM concept_relations WHERE note_id = ?
     UNION
     SELECT DISTINCT canonical_target AS term FROM concept_relations WHERE note_id = ?
     LIMIT 50`,
    [noteIdNum, noteIdNum]
  );

  const baseTerms = baseTermRows.map((r) => r.term).filter(Boolean);
  if (baseTerms.length === 0) return [];

  // Step 2: find candidate rows from other notes sharing those terms (cap at 2000)
  const ph = baseTerms.map(() => "?").join(",");
  const candidateRows = await dbAll<{
    note_id: number;
    term: string;
    support_count: number;
  }>(
    db,
    `SELECT note_id, canonical_source AS term, support_count
       FROM concept_relations
      WHERE note_id != ? AND canonical_source IN (${ph})
     UNION ALL
     SELECT note_id, canonical_target AS term, support_count
       FROM concept_relations
      WHERE note_id != ? AND canonical_target IN (${ph})
     LIMIT 2000`,
    [noteIdNum, ...baseTerms, noteIdNum, ...baseTerms]
  );

  // Step 3: aggregate score + shared terms per candidate note
  const agg = new Map<number, { score: number; terms: Set<string> }>();
  for (const row of candidateRows) {
    if (!agg.has(row.note_id)) agg.set(row.note_id, { score: 0, terms: new Set() });
    const entry = agg.get(row.note_id)!;
    entry.score += row.support_count;
    entry.terms.add(row.term);
  }

  console.log(
    `[RECOMMEND] noteId=${noteIdNum} terms=${baseTerms.length} candidates=${candidateRows.length} agg=${agg.size}`
  );

  // Step 4: filter by minScore, sort desc, top-k
  const ranked = Array.from(agg.entries())
    .filter(([, v]) => v.score >= minScore)
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, k);

  if (ranked.length === 0) return [];

  // Step 5: fetch titles from notes (COALESCE summary → content prefix)
  const ids = ranked.map(([id]) => id);
  const ph2 = ids.map(() => "?").join(",");
  const noteRows = await dbAll<{ id: number; title: string }>(
    db,
    `SELECT id, COALESCE(NULLIF(summary, ''), content) AS title FROM notes WHERE id IN (${ph2})`,
    ids
  );
  const titleMap = new Map(noteRows.map((r) => [r.id, r.title]));

  return ranked.map(([id, v]) => ({
    noteId: id.toString(),
    title: (titleMap.get(id) ?? "").slice(0, 30),
    score: v.score,
    sharedTerms: Array.from(v.terms).slice(0, maxSharedTermsShown),
    sharedCount: v.terms.size,
  }));
}
