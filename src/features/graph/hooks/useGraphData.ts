import { useState, useEffect, useCallback } from "react";
import ipc from "@/services/electronAPI";
import type { GraphQueryParams } from "@/types/electron-api";

export type DataSourceMode = "triples" | "relations";

export interface GraphEdgeWithScore {
  id: number;
  from: string;
  to: string;
  label?: string;
  /** Numeric weight (0–1) used for minWeight filtering; undefined in triples mode */
  weight?: number;
  /** concept_relations.id – used by EdgeEvidencePanel to fetch supporting evidence */
  relationId?: string;
}

export interface GraphData {
  nodes: any[];
  edges: GraphEdgeWithScore[];
}

export function useGraphData(queryParams: GraphQueryParams = {}) {
  const [graph, setGraph] = useState<GraphData>({ nodes: [], edges: [] });
  const [dataMode, setDataMode] = useState<DataSourceMode>("triples");
  const [loading, setLoading] = useState(false);

  // Destructure for stable primitive deps — avoids object reference churn
  const {
    mode: qMode,
    noteId: rawNoteId,
    depth = 1,
    limit = 200,
    minSupportCount = 1,
    minSupportingNotes = 1,
  } = queryParams;

  // Empty string noteId fallback → treat as global (no note filter)
  const noteId = rawNoteId?.trim() || undefined;
  const graphScope = qMode ?? (noteId ? "note" : "global");

  const loadGraph = useCallback(async () => {
    setLoading(true);
    try {
      if (dataMode === "triples") {
        // 🧠 三元組模式 — concept_relations (server-side filtered)
        console.debug("[Graph] loadGraph", { graphScope, noteId, depth, minSupportCount, minSupportingNotes });
        const res = await ipc.getKnowledgeGraph({
          mode: graphScope,
          noteId,
          depth: depth as 1 | 2,
          limit,
          minSupportCount,
          minSupportingNotes,
        });
        // API returns {source, target}; vis-network needs {from, to}
        const edges: GraphEdgeWithScore[] = (res.links || []).map(
          (l: any, i: number) => ({
            id: i,
            from: l.source,
            to: l.target,
            label: l.label,
            weight: undefined,
            relationId: l.relationId,
          })
        );
        setGraph({ nodes: res.nodes || [], edges });
      } else {
        // 🧠 語意關聯模式 — embedding similarity between notes
        const notes = await ipc.searchNote({ query: "" });

        const filterIdNum = noteId != null ? parseInt(noteId, 10) : null;
        const sourceNotes =
          filterIdNum != null
            ? notes.filter((n: any) => n.id === filterIdNum)
            : notes;

        const edges: GraphEdgeWithScore[] = [];
        const relatedIds = new Set<number>();

        for (const note of sourceNotes) {
          const res = await ipc.getRelatedNotes({ noteId: note.id.toString() });
          (res.related || []).forEach((r) => {
            // Normalize concept-count score to 0–1 for minWeight slider (cap at 10)
            const weight = Math.min(r.score / 10, 1);
            edges.push({
              id: edges.length,
              from: note.id.toString(),
              to: r.noteId,
              label: r.sharedCount.toString(),
              weight,
            });
            relatedIds.add(parseInt(r.noteId, 10));
          });
        }

        // Build node list (seed note + related notes)
        const visibleIds = new Set([
          ...sourceNotes.map((n: any) => n.id),
          ...relatedIds,
        ]);
        const visibleNotes =
          filterIdNum != null
            ? notes.filter((n: any) => visibleIds.has(n.id))
            : notes;

        const nodes = visibleNotes.map((n: any) => ({
          id: n.id.toString(),
          label: n.content.slice(0, 15),
          color: n.id === filterIdNum ? "#facc15" : "#3b82f6",
        }));

        setGraph({ nodes, edges });
      }
    } catch (err) {
      console.error("[Graph] loadGraph error:", err);
    } finally {
      setLoading(false);
    }
  }, [dataMode, graphScope, noteId, depth, limit, minSupportCount, minSupportingNotes]);

  const rebuild = useCallback(async () => {
    setLoading(true);
    try {
      await ipc.rebuildRelations();
      await loadGraph();
    } finally {
      setLoading(false);
    }
  }, [loadGraph]);

  const toggleMode = useCallback(() => {
    setDataMode((prev) => (prev === "triples" ? "relations" : "triples"));
  }, []);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  return { graph, mode: dataMode, loading, rebuild, toggleMode };
}
