/**
 * Component tests for RelatedNotesPanel.
 *
 * Preserved (14): all previous graph/semantic/search/topK/sort/copy tests
 * Phase 2 (6):
 *   N1 — score bar renders correct width via data-testid
 *   N2 — toggle-explain hides/shows chips-<id>
 *   N3 — clipboard success via data-testid copy-<id>
 *   N4 — clipboard failure falls back to window.prompt
 *   N5 — Escape key on window closes modal
 *   N6 — Escape on search input (with content) clears search, modal stays open
 * Phase 3 (5):
 *   N7 — ArrowDown selects first card (data-active)
 *   N8 — ArrowUp after two downs returns to first card
 *   N9 — Enter on active card navigates + calls onClose
 *   N10 — renderHighlight: <mark> wraps matched substring in card title
 *   N11 — pin-<id> refetches from pinned noteId and shows pin-indicator
 * Phase 4 (3):
 *   N12 — pin-toggle/unpin: second click unfreezes and restores original noteId
 *   N13 — chip label renders <mark> when search query matches chip text
 *   N14 — Esc precedence in sequence: first clears search, second closes modal
 * Phase 5 — Hybrid tab (8):
 *   H1 — 混合 tab calls both APIs once; merged cards visible
 *   H2 — slider changes hybridScore ordering without additional API calls
 *   H3 — same noteId in graph+semantic merges into one card with both badges
 *   H4 — graph-only item renders badge-graph, no badge-semantic
 *   H5 — semantic-only item renders badge-semantic, no badge-graph
 *   H6 — hybrid copy text uses sharedTerms when present
 *   H7 — hybrid chips highlight with <mark> on search match
 *   H8 — hybrid keyboard Enter navigates + calls onClose
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { RelatedNotesPanel } from "@/features/notes/components/RelatedNotesPanel";

// ── Fixtures ───────────────────────────────────────────────────────────────

const GRAPH_ONE = [
  {
    noteId: "42",
    title: "graph related note",
    score: 5,
    sharedTerms: ["alice", "bob"],
    sharedCount: 2,
  },
];

/** Two items for sort / search tests (scores 5 and 2). */
const GRAPH_TWO = [
  { noteId: "42", title: "higher score note", score: 5, sharedTerms: ["alice"], sharedCount: 1 },
  { noteId: "10", title: "lower score note",  score: 2, sharedTerms: ["bob"],   sharedCount: 1 },
];

const SEMANTIC_ONE = [{ noteId: "99", title: "semantic similar note", score: 0.876 }];

/**
 * Hybrid fixtures: 55 is graph-only (graphScoreNorm=0.5, semNorm=0),
 *                  77 is semantic-only (graphNorm=0, semNorm=0.9).
 * Weight=0.1 (graph-heavy): 55=0.45 > 77=0.09 → [55, 77]
 * Weight=0.9 (sem-heavy):   77=0.81 > 55=0.05 → [77, 55]
 */
const GRAPH_HYBRID = [
  { noteId: "55", title: "graph only note", score: 5, sharedTerms: ["db"], sharedCount: 1 },
];
const SEM_HYBRID = [
  { noteId: "77", title: "semantic only note", score: 0.9 },
];

/** Fixture where title AND a chip share the same token ("alice") for highlight testing. */
const GRAPH_CHIP_HIGHLIGHT = [
  {
    noteId: "42",
    title: "alice in wonderland note",
    score: 5,
    sharedTerms: ["alice", "bob"],
    sharedCount: 2,
  },
];

/**
 * Hybrid overlap: same noteId "42" appears in both graph and semantic.
 * Used for H3, H6, H7.
 */
const GRAPH_MERGED = [
  { noteId: "42", title: "shared merged note", score: 7, sharedTerms: ["ai", "ml"], sharedCount: 2 },
];
const SEM_MERGED = [
  { noteId: "42", title: "shared merged note", score: 0.8 },
];

/** Semantic-side companion to GRAPH_CHIP_HIGHLIGHT for hybrid chip-highlight test (H7). */
const SEM_CHIP_HIGHLIGHT = [
  { noteId: "42", title: "alice in wonderland note", score: 0.8 },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function stubClipboard(impl: { writeText: ReturnType<typeof vi.fn> }) {
  Object.defineProperty(navigator, "clipboard", {
    value: impl,
    writable: true,
    configurable: true,
  });
}

// ── Suite ──────────────────────────────────────────────────────────────────

describe("RelatedNotesPanel", () => {
  let getRelatedNotes: ReturnType<typeof vi.fn>;
  let getSemanticNotes: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getRelatedNotes = vi.fn().mockResolvedValue({ related: GRAPH_ONE });
    getSemanticNotes = vi.fn().mockResolvedValue({ related: SEMANTIC_ONE });
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

  // ══ Graph tab (preserved) ═══════════════════════════════════════════════

  it("(a) Graph tab — calls getRelatedNotes on mount, renders card + chips", async () => {
    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("card-note-42")).toBeInTheDocument());

    expect(getRelatedNotes).toHaveBeenCalledWith({ noteId: "7", k: 5 });
    expect(getSemanticNotes).not.toHaveBeenCalled();
    // chips visible by default (showExplain=true)
    expect(screen.getByTestId("chips-42")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("🔄 refresh (Graph) calls getRelatedNotes again", async () => {
    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => screen.getByTestId("card-note-42"));

    fireEvent.click(screen.getByTitle("重新整理"));
    await waitFor(() => expect(getRelatedNotes).toHaveBeenCalledTimes(2));
  });

  it("clicking card navigates to graph and calls onClose", async () => {
    const onClose = vi.fn();
    render(<RelatedNotesPanel noteId={7} onClose={onClose} />);
    await waitFor(() => screen.getByTestId("card-note-42"));

    fireEvent.click(screen.getByTestId("card-note-42"));

    expect(window.location.hash).toBe("#/graph?noteId=42");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Graph empty state — shows Worker hint", async () => {
    getRelatedNotes.mockResolvedValue({ related: [] });
    render(<RelatedNotesPanel noteId={99} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText("尚無相關筆記")).toBeInTheDocument());
    expect(screen.getByText(/Worker 處理完三元組/)).toBeInTheDocument();
  });

  it("backdrop click calls onClose", async () => {
    const onClose = vi.fn();
    const { container } = render(<RelatedNotesPanel noteId={7} onClose={onClose} />);
    await waitFor(() => screen.getByTestId("card-note-42"));

    fireEvent.click(container.firstChild!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("× close button calls onClose", async () => {
    const onClose = vi.fn();
    render(<RelatedNotesPanel noteId={7} onClose={onClose} />);
    await waitFor(() => screen.getByTestId("card-note-42"));

    fireEvent.click(screen.getByLabelText("關閉"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ══ Semantic tab (preserved) ════════════════════════════════════════════

  it("(b) Semantic tab — calls getSemanticNotes, renders score", async () => {
    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => screen.getByTestId("card-note-42"));

    fireEvent.click(screen.getByText("語意"));
    await waitFor(() => expect(screen.getByTestId("card-note-99")).toBeInTheDocument());

    expect(getSemanticNotes).toHaveBeenCalledWith({ noteId: "7", k: 5 });
    expect(getRelatedNotes).toHaveBeenCalledTimes(1); // no extra call
    expect(screen.getByText("相似 0.876")).toBeInTheDocument();
  });

  it("🔄 refresh (Semantic) calls getSemanticNotes only", async () => {
    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => screen.getByTestId("card-note-42"));
    fireEvent.click(screen.getByText("語意"));
    await waitFor(() => screen.getByTestId("card-note-99"));

    fireEvent.click(screen.getByTitle("重新整理"));
    await waitFor(() => expect(getSemanticNotes).toHaveBeenCalledTimes(2));
    expect(getRelatedNotes).toHaveBeenCalledTimes(1);
  });

  it("Semantic card click navigates and closes", async () => {
    const onClose = vi.fn();
    render(<RelatedNotesPanel noteId={7} onClose={onClose} />);
    await waitFor(() => screen.getByTestId("card-note-42"));
    fireEvent.click(screen.getByText("語意"));
    await waitFor(() => screen.getByTestId("card-note-99"));

    fireEvent.click(screen.getByTestId("card-note-99"));

    expect(window.location.hash).toBe("#/graph?noteId=99");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Semantic empty — shows embedding hint", async () => {
    getSemanticNotes.mockResolvedValue({ related: [] });
    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => screen.getByTestId("card-note-42"));
    fireEvent.click(screen.getByText("語意"));
    await waitFor(() => expect(screen.getByText("尚無相關筆記")).toBeInTheDocument());
    expect(screen.getByText(/embedding 向量/)).toBeInTheDocument();
  });

  // ══ Search / TopK / Sort (preserved) ════════════════════════════════════

  it("(c) search filter hides non-matching items", async () => {
    getRelatedNotes.mockResolvedValue({ related: GRAPH_TWO });
    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => screen.getByTestId("card-note-42"));

    fireEvent.change(screen.getByLabelText("搜尋"), { target: { value: "42" } });
    expect(screen.getByTestId("card-note-42")).toBeInTheDocument();
    expect(screen.queryByTestId("card-note-10")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("搜尋"), { target: { value: "zzz" } });
    expect(screen.getByText(/找不到符合/)).toBeInTheDocument();
  });

  it("(d) TopK change triggers API call with new k", async () => {
    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => screen.getByTestId("card-note-42"));
    expect(getRelatedNotes).toHaveBeenCalledWith({ noteId: "7", k: 5 });

    fireEvent.change(screen.getByLabelText("顯示筆數"), { target: { value: "3" } });
    await waitFor(() =>
      expect(getRelatedNotes).toHaveBeenCalledWith({ noteId: "7", k: 3 })
    );
  });

  it("(e) sort 低→高 reverses DOM order", async () => {
    getRelatedNotes.mockResolvedValue({ related: GRAPH_TWO });
    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => screen.getByTestId("card-note-42"));

    const before = screen.getAllByRole("listitem");
    expect(before[0]).toHaveTextContent("筆記 #42"); // score 5 first
    expect(before[1]).toHaveTextContent("筆記 #10"); // score 2 second

    fireEvent.change(screen.getByLabelText("排序"), { target: { value: "score_asc" } });

    const after = screen.getAllByRole("listitem");
    expect(after[0]).toHaveTextContent("筆記 #10"); // score 2 first
    expect(after[1]).toHaveTextContent("筆記 #42"); // score 5 second
  });

  // ══ New tests (N1–N6) ════════════════════════════════════════════════════

  // N1 — score bar width ─────────────────────────────────────────────────────
  it("N1 — scorebar-<id> width = Math.round(score/10*100)% for graph mode", async () => {
    // score=5 → normalized=0.5 → 50%
    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => screen.getByTestId("scorebar-42"));

    expect(screen.getByTestId("scorebar-42")).toHaveStyle("width: 50%");
  });

  it("N1b — scorebar-<id> width = Math.round(score*100)% for semantic mode", async () => {
    // score=0.876 → Math.round(87.6)=88 → 88%
    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => screen.getByTestId("card-note-42"));
    fireEvent.click(screen.getByText("語意"));
    await waitFor(() => screen.getByTestId("scorebar-99"));

    expect(screen.getByTestId("scorebar-99")).toHaveStyle("width: 88%");
  });

  // N2 — toggle-explain ──────────────────────────────────────────────────────
  it("N2 — toggle-explain-<id> hides and re-shows chips-<id>", async () => {
    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => screen.getByTestId("card-note-42"));

    // chips visible by default
    expect(screen.getByTestId("chips-42")).toBeInTheDocument();

    // collapse
    fireEvent.click(screen.getByTestId("toggle-explain-42"));
    expect(screen.queryByTestId("chips-42")).not.toBeInTheDocument();

    // expand again
    fireEvent.click(screen.getByTestId("toggle-explain-42"));
    expect(screen.getByTestId("chips-42")).toBeInTheDocument();
  });

  // N3 — clipboard success via data-testid ──────────────────────────────────
  it("N3 — copy-<id> button writes formatted text to clipboard (success)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });

    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => screen.getByTestId("copy-42"));

    fireEvent.click(screen.getByTestId("copy-42"));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        "筆記 #42: graph related note（共享：alice、bob）"
      )
    );
  });

  // N4 — clipboard failure → window.prompt ──────────────────────────────────
  it("N4 — clipboard failure falls back to window.prompt with the text", async () => {
    stubClipboard({ writeText: vi.fn().mockRejectedValue(new Error("denied")) });
    const promptSpy = vi.fn().mockReturnValue(null);
    vi.stubGlobal("prompt", promptSpy);

    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => screen.getByTestId("copy-42"));

    fireEvent.click(screen.getByTestId("copy-42"));

    await waitFor(() =>
      expect(promptSpy).toHaveBeenCalledWith(
        "複製此文字：",
        "筆記 #42: graph related note（共享：alice、bob）"
      )
    );
  });

  // N5 — Escape on window closes modal ──────────────────────────────────────
  it("N5 — Escape keydown on window calls onClose", async () => {
    const onClose = vi.fn();
    render(<RelatedNotesPanel noteId={7} onClose={onClose} />);
    await waitFor(() => screen.getByTestId("card-note-42"));

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // N6 — Escape on search input ─────────────────────────────────────────────
  it("N6 — Escape on non-empty search clears it; modal stays open", async () => {
    const onClose = vi.fn();
    render(<RelatedNotesPanel noteId={7} onClose={onClose} />);
    await waitFor(() => screen.getByTestId("card-note-42"));

    const input = screen.getByLabelText("搜尋");
    fireEvent.change(input, { target: { value: "graph" } });
    expect(input).toHaveValue("graph");

    fireEvent.keyDown(input, { key: "Escape" });

    expect(input).toHaveValue(""); // cleared
    expect(onClose).not.toHaveBeenCalled(); // modal stays open
  });

  // ══ Keyboard navigation (N7–N9) ══════════════════════════════════════════

  // N7 — ArrowDown selects first card ───────────────────────────────────────
  it("N7 — ArrowDown selects first card (data-active='true')", async () => {
    getRelatedNotes.mockResolvedValue({ related: GRAPH_TWO });
    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => screen.getByTestId("card-note-42"));

    // Initially no card is active
    expect(screen.getByTestId("card-note-42")).toHaveAttribute("data-active", "false");
    expect(screen.getByTestId("card-note-10")).toHaveAttribute("data-active", "false");

    fireEvent.keyDown(window, { key: "ArrowDown" });

    await waitFor(() =>
      expect(screen.getByTestId("card-note-42")).toHaveAttribute("data-active", "true")
    );
    expect(screen.getByTestId("card-note-10")).toHaveAttribute("data-active", "false");
  });

  // N8 — ArrowUp returns to first after two downs ───────────────────────────
  it("N8 — ArrowUp after two ArrowDowns returns to first card", async () => {
    getRelatedNotes.mockResolvedValue({ related: GRAPH_TWO });
    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => screen.getByTestId("card-note-42"));

    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    await waitFor(() =>
      expect(screen.getByTestId("card-note-10")).toHaveAttribute("data-active", "true")
    );

    fireEvent.keyDown(window, { key: "ArrowUp" });
    await waitFor(() =>
      expect(screen.getByTestId("card-note-42")).toHaveAttribute("data-active", "true")
    );
    expect(screen.getByTestId("card-note-10")).toHaveAttribute("data-active", "false");
  });

  // N9 — Enter on active card navigates + closes ────────────────────────────
  it("N9 — Enter on active card navigates to graph and calls onClose", async () => {
    const onClose = vi.fn();
    render(<RelatedNotesPanel noteId={7} onClose={onClose} />);
    await waitFor(() => screen.getByTestId("card-note-42"));

    fireEvent.keyDown(window, { key: "ArrowDown" });
    await waitFor(() =>
      expect(screen.getByTestId("card-note-42")).toHaveAttribute("data-active", "true")
    );

    fireEvent.keyDown(window, { key: "Enter" });
    expect(window.location.hash).toBe("#/graph?noteId=42");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ══ Highlight (N10) ═══════════════════════════════════════════════════════

  it("N10 — renderHighlight renders <mark> for matching search query", async () => {
    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => screen.getByTestId("card-note-42"));

    fireEvent.change(screen.getByLabelText("搜尋"), { target: { value: "graph" } });

    await waitFor(() => expect(document.querySelector("mark")).toBeInTheDocument());
    expect(document.querySelector("mark")!.textContent).toBe("graph");
  });

  // ══ Pin (N11) ════════════════════════════════════════════════════════════

  it("N11 — pin-<id> refetches from pinned noteId and shows pin-indicator", async () => {
    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => screen.getByTestId("card-note-42"));
    expect(getRelatedNotes).toHaveBeenCalledTimes(1);
    expect(getRelatedNotes).toHaveBeenCalledWith({ noteId: "7", k: 5 });

    fireEvent.click(screen.getByTestId("pin-42"));

    await waitFor(() =>
      expect(getRelatedNotes).toHaveBeenCalledWith({ noteId: "42", k: 5 })
    );
    expect(screen.getByTestId("pin-indicator")).toBeInTheDocument();
  });

  // ══ Phase 4: pin-toggle, chips highlight, Esc sequence ═══════════════════

  // N12 — pin-toggle / unpin ────────────────────────────────────────────────
  it("N12 — pin-toggle: clicking pin again unfreezes and restores original noteId", async () => {
    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => screen.getByTestId("card-note-42"));
    expect(getRelatedNotes).toHaveBeenCalledTimes(1);

    // Pin note 42 → effectiveNoteId becomes "42"
    fireEvent.click(screen.getByTestId("pin-42"));
    await waitFor(() => expect(screen.getByTestId("pin-indicator")).toBeInTheDocument());
    // Wait for the reload triggered by pin to complete
    await waitFor(() => screen.getByTestId("card-note-42"));

    // Unpin — click pin-42 again while it is the active pin
    fireEvent.click(screen.getByTestId("pin-42"));
    await waitFor(() =>
      expect(screen.queryByTestId("pin-indicator")).not.toBeInTheDocument()
    );
    // 3 fetches total: initial "7", pin "42", unpin back to "7"
    await waitFor(() => expect(getRelatedNotes).toHaveBeenCalledTimes(3));
    expect(getRelatedNotes).toHaveBeenLastCalledWith({ noteId: "7", k: 5 });
  });

  // N13 — chips highlight ───────────────────────────────────────────────────
  it("N13 — chip label renders <mark> when search query matches chip text", async () => {
    getRelatedNotes.mockResolvedValue({ related: GRAPH_CHIP_HIGHLIGHT });
    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => screen.getByTestId("card-note-42"));

    // "alice" appears in title → card stays visible; "alice" chip should be highlighted
    fireEvent.change(screen.getByLabelText("搜尋"), { target: { value: "alice" } });
    await waitFor(() => screen.getByTestId("chips-42"));

    const mark = screen.getByTestId("chips-42").querySelector("mark");
    expect(mark).toBeInTheDocument();
    expect(mark!.textContent).toBe("alice");
  });

  // N14 — Esc precedence in sequence ───────────────────────────────────────
  it("N14 — Esc: first press clears search (modal stays); second press closes modal", async () => {
    const onClose = vi.fn();
    render(<RelatedNotesPanel noteId={7} onClose={onClose} />);
    await waitFor(() => screen.getByTestId("card-note-42"));

    const input = screen.getByLabelText("搜尋");
    fireEvent.change(input, { target: { value: "graph" } });
    expect(input).toHaveValue("graph");

    // First Esc: search non-empty → clears, modal stays open
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(input).toHaveValue(""));
    expect(onClose).not.toHaveBeenCalled();

    // Second Esc: search now empty → closes modal
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ══ Phase 5: Hybrid tab (H1–H2) ══════════════════════════════════════════

  // H1 — 混合 tab calls both APIs ────────────────────────────────────────────
  it("H1 — 混合 tab calls both getRelatedNotes and getSemanticNotes; shows merged cards", async () => {
    getRelatedNotes.mockResolvedValue({ related: GRAPH_HYBRID });
    getSemanticNotes.mockResolvedValue({ related: SEM_HYBRID });

    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    // Wait for initial graph tab load (GRAPH_HYBRID → card-note-55)
    await waitFor(() => screen.getByTestId("card-note-55"));

    const graphCallsBefore = getRelatedNotes.mock.calls.length;
    const semCallsBefore = getSemanticNotes.mock.calls.length;

    // Switch to hybrid tab
    fireEvent.click(screen.getByText("混合"));
    // card-note-77 comes from SEM_HYBRID (semantic-only note)
    await waitFor(() => screen.getByTestId("card-note-77"));

    // Exactly one additional call to each API
    expect(getRelatedNotes.mock.calls.length).toBe(graphCallsBefore + 1);
    expect(getSemanticNotes.mock.calls.length).toBe(semCallsBefore + 1);
    // Both merged items visible
    expect(screen.getByTestId("card-note-55")).toBeInTheDocument();
    expect(screen.getByTestId("card-note-77")).toBeInTheDocument();
  });

  // H2 — slider changes DOM order without additional API calls ──────────────
  it("H2 — slider changes hybridScore ordering without additional API calls", async () => {
    getRelatedNotes.mockResolvedValue({ related: GRAPH_HYBRID });
    getSemanticNotes.mockResolvedValue({ related: SEM_HYBRID });

    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => screen.getByTestId("card-note-55"));

    fireEvent.click(screen.getByText("混合"));
    await waitFor(() => {
      expect(screen.getByTestId("card-note-55")).toBeInTheDocument();
      expect(screen.getByTestId("card-note-77")).toBeInTheDocument();
    });

    const totalCallsAfterLoad =
      getRelatedNotes.mock.calls.length + getSemanticNotes.mock.calls.length;

    // graph-heavy (0.1): 55=(0.1×0 + 0.9×0.5)=0.45, 77=(0.1×0.9 + 0.9×0)=0.09 → [55, 77]
    fireEvent.change(screen.getByLabelText("語意權重"), { target: { value: "0.1" } });
    await waitFor(() => {
      const cards = screen.getAllByRole("listitem");
      expect(cards[0]).toHaveTextContent("筆記 #55");
    });
    expect(screen.getAllByRole("listitem")[1]).toHaveTextContent("筆記 #77");

    // semantic-heavy (0.9): 77=(0.9×0.9 + 0.1×0)=0.81, 55=(0.9×0 + 0.1×0.5)=0.05 → [77, 55]
    fireEvent.change(screen.getByLabelText("語意權重"), { target: { value: "0.9" } });
    await waitFor(() => {
      const cards = screen.getAllByRole("listitem");
      expect(cards[0]).toHaveTextContent("筆記 #77");
    });
    expect(screen.getAllByRole("listitem")[1]).toHaveTextContent("筆記 #55");

    // Slider caused zero additional API calls
    expect(
      getRelatedNotes.mock.calls.length + getSemanticNotes.mock.calls.length
    ).toBe(totalCallsAfterLoad);
  });

  // H3 — same noteId merges into one card, both badges present ──────────────
  it("H3 — same noteId in graph+semantic merges into one card with both badges", async () => {
    getRelatedNotes.mockResolvedValue({ related: GRAPH_MERGED });
    getSemanticNotes.mockResolvedValue({ related: SEM_MERGED });

    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => screen.getByTestId("card-note-42")); // initial graph load

    fireEvent.click(screen.getByText("混合"));
    await waitFor(() => screen.getByTestId("badge-graph-42"));

    // Exactly one card for noteId 42 (not two)
    expect(screen.queryAllByTestId("card-note-42")).toHaveLength(1);
    // Both source badges present
    expect(screen.getByTestId("badge-graph-42")).toBeInTheDocument();
    expect(screen.getByTestId("badge-semantic-42")).toBeInTheDocument();
  });

  // H4 — graph-only item: Graph badge shown, Semantic badge absent ───────────
  it("H4 — graph-only item renders badge-graph but not badge-semantic", async () => {
    getRelatedNotes.mockResolvedValue({ related: GRAPH_HYBRID }); // noteId "55"
    getSemanticNotes.mockResolvedValue({ related: [] });           // no semantic

    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => screen.getByTestId("card-note-55")); // initial graph load

    fireEvent.click(screen.getByText("混合"));
    await waitFor(() => screen.getByTestId("badge-graph-55"));

    expect(screen.getByTestId("badge-graph-55")).toBeInTheDocument();
    expect(screen.queryByTestId("badge-semantic-55")).not.toBeInTheDocument();
  });

  // H5 — semantic-only item: Semantic badge shown, Graph badge absent ─────────
  it("H5 — semantic-only item renders badge-semantic but not badge-graph", async () => {
    getRelatedNotes.mockResolvedValue({ related: [] });          // no graph
    getSemanticNotes.mockResolvedValue({ related: SEM_HYBRID }); // noteId "77"

    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    // Initial graph tab returns empty → empty state
    await waitFor(() => screen.getByText("尚無相關筆記"));

    fireEvent.click(screen.getByText("混合"));
    await waitFor(() => screen.getByTestId("badge-semantic-77"));

    expect(screen.getByTestId("badge-semantic-77")).toBeInTheDocument();
    expect(screen.queryByTestId("badge-graph-77")).not.toBeInTheDocument();
  });

  // H6 — hybrid copy text uses sharedTerms when present ─────────────────────
  it("H6 — hybrid copy writes sharedTerms text when item has graph data", async () => {
    getRelatedNotes.mockResolvedValue({ related: GRAPH_MERGED }); // sharedTerms: ["ai","ml"]
    getSemanticNotes.mockResolvedValue({ related: SEM_MERGED });

    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });

    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => screen.getByTestId("card-note-42"));

    fireEvent.click(screen.getByText("混合"));
    await waitFor(() => screen.getByTestId("copy-42"));

    fireEvent.click(screen.getByTestId("copy-42"));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        "筆記 #42: shared merged note（共享：ai、ml）"
      )
    );
  });

  // H7 — hybrid chips highlight with <mark> ─────────────────────────────────
  it("H7 — hybrid chip label renders <mark> when search query matches chip text", async () => {
    getRelatedNotes.mockResolvedValue({ related: GRAPH_CHIP_HIGHLIGHT }); // sharedTerms: ["alice","bob"]
    getSemanticNotes.mockResolvedValue({ related: SEM_CHIP_HIGHLIGHT });

    render(<RelatedNotesPanel noteId={7} onClose={() => {}} />);
    await waitFor(() => screen.getByTestId("card-note-42"));

    fireEvent.click(screen.getByText("混合"));
    // title "alice in wonderland note" keeps card visible; chip "alice" should be marked
    await waitFor(() => screen.getByTestId("chips-42"));

    fireEvent.change(screen.getByLabelText("搜尋"), { target: { value: "alice" } });
    await waitFor(() => screen.getByTestId("chips-42"));

    const mark = screen.getByTestId("chips-42").querySelector("mark");
    expect(mark).toBeInTheDocument();
    expect(mark!.textContent).toBe("alice");
  });

  // H8 — hybrid keyboard Enter navigates + closes ───────────────────────────
  it("H8 — hybrid keyboard Enter on active card navigates to graph and calls onClose", async () => {
    getRelatedNotes.mockResolvedValue({ related: GRAPH_HYBRID }); // noteId "55"
    getSemanticNotes.mockResolvedValue({ related: SEM_HYBRID });  // noteId "77"

    const onClose = vi.fn();
    render(<RelatedNotesPanel noteId={7} onClose={onClose} />);
    await waitFor(() => screen.getByTestId("card-note-55")); // initial graph load

    fireEvent.click(screen.getByText("混合"));
    // default weight=0.6: 77=(0.6×0.9)=0.54 > 55=(0.4×0.5)=0.20 → first card is 77
    await waitFor(() => screen.getByTestId("card-note-77"));

    fireEvent.keyDown(window, { key: "ArrowDown" });
    await waitFor(() =>
      expect(screen.getByTestId("card-note-77")).toHaveAttribute("data-active", "true")
    );

    fireEvent.keyDown(window, { key: "Enter" });
    expect(window.location.hash).toBe("#/graph?noteId=77");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
