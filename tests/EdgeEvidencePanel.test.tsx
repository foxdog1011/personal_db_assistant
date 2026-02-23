/**
 * tests/EdgeEvidencePanel.test.tsx
 *
 * Tests (8):
 *   1. shows loading skeleton while fetching, then removed after resolve
 *   2. calls getRelationEvidence with correct relationId (relation mode)
 *   3. renders evidence items; clicking item navigates hash + calls onClose
 *   4. shows empty state when evidence is empty
 *   f. in canonical mode, calls getCanonicalEdgeEvidence (not getRelationEvidence)
 *   6. renders confidence badge with correct percentage when confidence present
 *   7. renders <mark> elements when bestSentence is present (safe highlight)
 *   8. clicking item navigates hash + calls onClose (with bestSentence/confidence present)
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { EdgeEvidencePanel } from "@/features/graph/components/EdgeEvidencePanel";

// ── Fixture ───────────────────────────────────────────────────────────────────

const EVIDENCE = [
  {
    noteId: "10",
    title: "Alice knows Bob",
    snippet: "alice knows bob in this story",
    createdAt: "2024-01-01T00:00:00Z",
    bestSentence: "alice knows bob in this story",
    confidence: 0.9,
  },
];

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("EdgeEvidencePanel", () => {
  let getRelationEvidence: ReturnType<typeof vi.fn>;
  let getCanonicalEdgeEvidence: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getRelationEvidence = vi.fn().mockResolvedValue({ evidence: EVIDENCE });
    getCanonicalEdgeEvidence = vi.fn().mockResolvedValue({ evidence: EVIDENCE });
    (window as any).electronAPI = {
      ...((window as any).electronAPI || {}),
      getRelationEvidence,
      getCanonicalEdgeEvidence,
    };
    window.location.hash = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // Test 1 ─────────────────────────────────────────────────────────────────────
  it("shows loading skeleton while fetching, then hides it after data resolves", async () => {
    let resolveEvidence!: (v: any) => void;
    getRelationEvidence.mockReturnValue(
      new Promise((res) => { resolveEvidence = res; })
    );

    render(
      <EdgeEvidencePanel
        relationId="5"
        fromLabel="alice"
        toLabel="bob"
        onClose={() => {}}
      />
    );

    expect(screen.getByTestId("evidence-loading")).toBeInTheDocument();

    resolveEvidence({ evidence: EVIDENCE });

    await waitFor(() =>
      expect(screen.queryByTestId("evidence-loading")).not.toBeInTheDocument()
    );
    expect(screen.getByTestId("evidence-item-10")).toBeInTheDocument();
  });

  // Test 2 ─────────────────────────────────────────────────────────────────────
  it("calls getRelationEvidence with the correct relationId and limit in relation mode", async () => {
    render(
      <EdgeEvidencePanel
        relationId="42"
        fromLabel="a"
        toLabel="b"
        onClose={() => {}}
      />
    );

    await waitFor(() =>
      expect(getRelationEvidence).toHaveBeenCalledWith({ relationId: "42", limit: 5 })
    );
    expect(getCanonicalEdgeEvidence).not.toHaveBeenCalled();
  });

  // Test 3 ─────────────────────────────────────────────────────────────────────
  it("renders evidence items; clicking item sets location.hash and calls onClose", async () => {
    const onClose = vi.fn();

    render(
      <EdgeEvidencePanel
        relationId="5"
        fromLabel="a"
        toLabel="b"
        onClose={onClose}
      />
    );

    await waitFor(() => screen.getByTestId("evidence-item-10"));

    fireEvent.click(screen.getByTestId("evidence-item-10"));

    expect(window.location.hash).toBe("#/graph?noteId=10");
    expect(onClose).toHaveBeenCalledOnce();
  });

  // Test 4 ─────────────────────────────────────────────────────────────────────
  it("shows empty state text when evidence array is empty", async () => {
    getRelationEvidence.mockResolvedValue({ evidence: [] });

    render(
      <EdgeEvidencePanel
        relationId="99"
        fromLabel="x"
        toLabel="y"
        onClose={() => {}}
      />
    );

    await waitFor(() => screen.getByTestId("evidence-empty"));
    expect(screen.getByTestId("evidence-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("evidence-loading")).not.toBeInTheDocument();
  });

  // Test f ─────────────────────────────────────────────────────────────────────
  it("f) canonical mode calls getCanonicalEdgeEvidence (not getRelationEvidence)", async () => {
    render(
      <EdgeEvidencePanel
        canonical={{ source: "alice", target: "bob", relation: "knows" }}
        fromLabel="alice"
        toLabel="bob"
        onClose={() => {}}
      />
    );

    await waitFor(() =>
      expect(getCanonicalEdgeEvidence).toHaveBeenCalledWith({
        canonicalSource: "alice",
        canonicalTarget: "bob",
        relation: "knows",
        limit: 5,
      })
    );
    expect(getRelationEvidence).not.toHaveBeenCalled();
    await waitFor(() => screen.getByTestId("evidence-item-10"));
  });

  // Test 6 ─────────────────────────────────────────────────────────────────────
  it("6) renders confidence badge showing rounded percentage when confidence is present", async () => {
    render(
      <EdgeEvidencePanel
        relationId="5"
        fromLabel="alice"
        toLabel="bob"
        onClose={() => {}}
      />
    );

    await waitFor(() => screen.getByTestId("evidence-item-10"));
    const badge = screen.getByTestId("evidence-confidence-10");
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toBe("90%"); // Math.round(0.9 * 100)
  });

  // Test 7 ─────────────────────────────────────────────────────────────────────
  it("7) renders <mark> highlight elements for terms when bestSentence is present", async () => {
    render(
      <EdgeEvidencePanel
        relationId="5"
        fromLabel="alice"
        toLabel="bob"
        onClose={() => {}}
      />
    );

    await waitFor(() => screen.getByTestId("evidence-item-10"));

    // The bestSentence contains "alice" and "bob" — both should be wrapped in <mark>
    const item = screen.getByTestId("evidence-item-10");
    const marks = item.querySelectorAll("mark");
    expect(marks.length).toBeGreaterThan(0);
  });

  // Test 8 ─────────────────────────────────────────────────────────────────────
  it("8) clicking item with bestSentence/confidence still sets location.hash and calls onClose", async () => {
    const onClose = vi.fn();

    render(
      <EdgeEvidencePanel
        relationId="5"
        fromLabel="alice"
        toLabel="bob"
        onClose={onClose}
      />
    );

    await waitFor(() => screen.getByTestId("evidence-item-10"));

    fireEvent.click(screen.getByTestId("evidence-item-10"));

    expect(window.location.hash).toBe("#/graph?noteId=10");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
