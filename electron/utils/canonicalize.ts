/**
 * Normalize a concept string to a stable canonical form for graph deduplication.
 *
 * Rules (applied in order):
 *   1. Trim surrounding whitespace
 *   2. NFKC Unicode normalization (fullwidth → ASCII, ligatures, etc.)
 *   3. Lowercase
 *   4. Collapse internal whitespace runs to a single space
 *   5. Strip leading punctuation/whitespace (., ; : ( ) [ ] { } " ' ` CJK punctuation ! ?)
 *   6. Strip trailing punctuation/whitespace (same set)
 */
export function canonicalizeConcept(input: string): string {
  let s = (input ?? "").trim();
  if (!s) return "";
  if (s.normalize) s = s.normalize("NFKC");
  s = s.toLowerCase();
  s = s.replace(/\s+/g, " ");
  s = s.replace(/^[\s\.,:;()\[\]{}"'`，。！？!？]+/, "");
  s = s.replace(/[\s\.,:;()\[\]{}"'`，。！？!？]+$/, "");
  return s;
}
