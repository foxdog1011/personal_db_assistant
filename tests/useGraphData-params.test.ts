/**
 * Tests that useGraphData correctly derives and forwards GraphQueryParams
 * to electronAPI.getKnowledgeGraph.
 *
 * Strategy: override window.electronAPI.getKnowledgeGraph with a vi.fn() spy
 * before each test, then inspect what args it was called with.
 */
import { renderHook, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useGraphData } from "@/features/graph/hooks/useGraphData";
import type { GraphQueryParams } from "@/types/electron-api";

function makeElectronAPIMock() {
  const getKnowledgeGraph = vi.fn().mockResolvedValue({ nodes: [], links: [] });
  const searchNote = vi.fn().mockResolvedValue([]);
  const getRelatedNotes = vi.fn().mockResolvedValue([]);
  const rebuildRelations = vi.fn().mockResolvedValue({ success: true, totalNotes: 0, totalRelations: 0 });
  return { getKnowledgeGraph, searchNote, getRelatedNotes, rebuildRelations };
}

describe("useGraphData — queryParams forwarding", () => {
  let mock: ReturnType<typeof makeElectronAPIMock>;

  beforeEach(() => {
    mock = makeElectronAPIMock();
    (window as any).electronAPI = {
      ...((window as any).electronAPI || {}),
      ...mock,
    };
  });

  it("mode=note + noteId → IPC called with mode='note' and noteId", async () => {
    const params: GraphQueryParams = { mode: "note", noteId: "5", depth: 1 };
    const { result } = renderHook(() => useGraphData(params));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mock.getKnowledgeGraph).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "note", noteId: "5" })
    );
  });

  it("empty string noteId falls back to mode='global' with noteId=undefined", async () => {
    const params: GraphQueryParams = { noteId: "" };
    const { result } = renderHook(() => useGraphData(params));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mock.getKnowledgeGraph).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "global", noteId: undefined })
    );
  });

  it("mode=global + minSupportingNotes=3 → IPC receives minSupportingNotes=3", async () => {
    const params: GraphQueryParams = { mode: "global", minSupportingNotes: 3 };
    const { result } = renderHook(() => useGraphData(params));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mock.getKnowledgeGraph).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "global", minSupportingNotes: 3 })
    );
  });

  it("no params → defaults to mode='global', minSupportingNotes=1", async () => {
    const { result } = renderHook(() => useGraphData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mock.getKnowledgeGraph).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "global", minSupportingNotes: 1 })
    );
  });

  it("whitespace-only noteId treated as empty → falls back to global", async () => {
    const params: GraphQueryParams = { noteId: "   " };
    const { result } = renderHook(() => useGraphData(params));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mock.getKnowledgeGraph).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "global", noteId: undefined })
    );
  });
});
