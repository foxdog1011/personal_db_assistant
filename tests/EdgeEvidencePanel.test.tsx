/**
 * tests/EdgeEvidencePanel.test.tsx
 *
 * E4 UI tests (4):
 *   1. shows loading skeleton while fetching, then removes it after resolve
 *   2. calls getRelationEvidence with correct relationId
 *   3. renders evidence items; clicking item sets location.hash and calls onClose
 *   4. shows empty state when evidence is empty
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
  },
];

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("EdgeEvidencePanel", () => {
  let getRelationEvidence: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getRelationEvidence = vi.fn().mockResolvedValue({ evidence: EVIDENCE });
    (window as any).electronAPI = {
      ...((window as any).electronAPI || {}),
      getRelationEvidence,
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

    // Loading skeleton should be present immediately
    expect(screen.getByTestId("evidence-loading")).toBeInTheDocument();

    // Resolve the promise
    resolveEvidence({ evidence: EVIDENCE });

    await waitFor(() =>
      expect(screen.queryByTestId("evidence-loading")).not.toBeInTheDocument()
    );
    expect(screen.getByTestId("evidence-item-10")).toBeInTheDocument();
  });

  // Test 2 ─────────────────────────────────────────────────────────────────────
  it("calls getRelationEvidence with the correct relationId and limit", async () => {
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
});
