/**
 * tests/sentence-picker.test.ts
 *
 * Tests for pickBestSentence (mirrored from electron/db/query.ts):
 *   1. both terms in same sentence → confidence 0.9
 *   2. only one term in content → confidence 0.6
 *   3. no term match → confidence 0.3, uses first 150 chars
 */
import { describe, it, expect } from "vitest";

// ── Mirror of pickBestSentence (no electron/ import) ──────────────────────────

function pickBestSentence(
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

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("pickBestSentence", () => {
  // Test 1 ─────────────────────────────────────────────────────────────────────
  it("1) returns confidence 0.9 when a sentence contains both source and target", () => {
    const content = "The weather is nice. Alice knows Bob from school. They met last year.";
    const { sentence, confidence } = pickBestSentence(content, "alice", "bob");
    expect(confidence).toBe(0.9);
    expect(sentence.toLowerCase()).toContain("alice");
    expect(sentence.toLowerCase()).toContain("bob");
  });

  // Test 2 ─────────────────────────────────────────────────────────────────────
  it("2) returns confidence 0.6 when a sentence contains only one of the terms", () => {
    const content = "The sky is blue. Alice went to the market. No mention of the other person.";
    const { sentence, confidence } = pickBestSentence(content, "alice", "charlie");
    expect(confidence).toBe(0.6);
    expect(sentence.toLowerCase()).toContain("alice");
  });

  // Test 3 ─────────────────────────────────────────────────────────────────────
  it("3) returns confidence 0.3 and first 150 chars when neither term appears", () => {
    const content = "x".repeat(200);
    const { sentence, confidence } = pickBestSentence(content, "alice", "bob");
    expect(confidence).toBe(0.3);
    expect(sentence.length).toBeLessThanOrEqual(150);
  });
});
