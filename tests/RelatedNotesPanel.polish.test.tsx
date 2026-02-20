/**
 * tests/RelatedNotesPanel.polish.test.tsx
 *
 * UI-5 polish tests (6):
 *   P1 — control bar is sticky (class present)
 *   P2 — snippet is clamped (line-clamp class present)
 *   P3 — hover/active card has ring classes
 *   P4 — empty state shows icon + CTA button per tab
 *   P5 — error state renders retry button; clicking triggers refetch
 *   P6 — hybrid slider re-sorts without refetching APIs (spy count)
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { RelatedNotesPanel } from "@/features/notes/components/RelatedNotesPanel";

// ── Fixtures (self-contained, not shared with main test file) ────────────────

const GRAPH_ONE = [
  { noteId: "42", title: "graph related note", score: 5, sharedTerms: ["alice"], sharedCount: 1 },
];

const GRAPH_HYBRID = [
  { noteId: "55", title: "graph only note", score: 5, sharedTerms: ["db"], sharedCount: 1 },
];
const SEM_HYBRID = [{ noteId: "77", title: "semantic only note", score: 0.9 }];

// ── Suite ────────────────────────────────────────────────────────────────────

describe("RelatedNotesPanel — UI-5 polish", () => {
  let getRelatedNotes: ReturnType<typeof vi.fn>;
  let getSemanticNotes: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getRelatedNotes = vi.fn().mockResolvedValue({ related: GRAPH_ONE });
    getSemanticNotes = vi.fn().mockResolvedValue({ related: [] });
    (window as any).electronAPI = {
      ...((window as any).electronAPI || {}),
      getRelatedNotes,
      getSemanticNotes,
    };
    window.location.hash = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // P1 — control bar is sticky ───────────────────────────────────────────────
  it("P1 — control bar is sticky", () => {
    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    const bar = screen.getByTestId("control-bar");
    expect(bar.className).toMatch(/sticky/);
  });

  // P2 — snippet is clamped ──────────────────────────────────────────────────
  it("P2 — snippet text has line-clamp class", async () => {
    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => screen.getByTestId("card-note-42"));
    const card = screen.getByTestId("card-note-42");
    const snippet = card.querySelector('[class*="line-clamp"]');
    expect(snippet).not.toBeNull();
  });

  // P3 — hover/active card ring ──────────────────────────────────────────────
  it("P3 — inactive card has hover:ring class; active card has ring-2", async () => {
    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => screen.getByTestId("card-note-42"));
    const card = screen.getByTestId("card-note-42");

    // Before activation: className includes hover:ring
    expect(card.className).toMatch(/hover:ring/);

    // Activate via mouseEnter → data-active switches to "true"
    fireEvent.mouseEnter(card);
    await waitFor(() => expect(card.getAttribute("data-active")).toBe("true"));
    // Active class includes ring-2
    expect(card.className).toMatch(/ring-2/);
  });

  // P4 — empty state CTA per tab ─────────────────────────────────────────────
  it("P4 — empty state shows CTA button on graph tab and semantic tab", async () => {
    getRelatedNotes.mockResolvedValue({ related: [] });
    getSemanticNotes.mockResolvedValue({ related: [] });

    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);

    // Graph tab: empty → CTA visible
    await waitFor(() => screen.getByTestId("empty-cta"));
    expect(screen.getByTestId("empty-cta")).toBeInTheDocument();

    // Switch to 語意 tab → also empty → CTA visible
    fireEvent.click(screen.getByText("語意"));
    await waitFor(() => screen.getByTestId("empty-cta"));
    expect(screen.getByTestId("empty-cta")).toBeInTheDocument();
  });

  // P5 — error state + retry ─────────────────────────────────────────────────
  it("P5 — error state shows retry button; clicking it triggers a new fetch", async () => {
    getRelatedNotes.mockRejectedValue(new Error("network error"));

    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => screen.getByTestId("error-retry"));

    const callsBefore = getRelatedNotes.mock.calls.length;
    fireEvent.click(screen.getByTestId("error-retry"));

    await waitFor(() => {
      expect(getRelatedNotes.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  // P6 — hybrid slider: no refetch ───────────────────────────────────────────
  it("P6 — hybrid slider re-sorts without additional API calls", async () => {
    getRelatedNotes.mockResolvedValue({ related: GRAPH_HYBRID });
    getSemanticNotes.mockResolvedValue({ related: SEM_HYBRID });

    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => screen.getByTestId("card-note-55")); // initial graph load

    // Switch to hybrid tab (triggers one more fetch of each API)
    fireEvent.click(screen.getByText("混合"));
    await waitFor(() => {
      expect(screen.getByTestId("card-note-55")).toBeInTheDocument();
      expect(screen.getByTestId("card-note-77")).toBeInTheDocument();
    });

    const graphCalls = getRelatedNotes.mock.calls.length;
    const semCalls = getSemanticNotes.mock.calls.length;

    // Move the hybrid weight slider
    fireEvent.change(screen.getByLabelText("語意權重"), { target: { value: "0.9" } });

    // API call counts must stay the same — slider only triggers useMemo re-sort
    expect(getRelatedNotes.mock.calls.length).toBe(graphCalls);
    expect(getSemanticNotes.mock.calls.length).toBe(semCalls);

    // But cards are still present (re-sort happened in memory)
    expect(screen.getByTestId("card-note-55")).toBeInTheDocument();
    expect(screen.getByTestId("card-note-77")).toBeInTheDocument();
  });
});
