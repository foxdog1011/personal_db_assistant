// src/features/graph/hooks/useKnowledgeGraph.ts
import { useEffect, useState } from "react";
import { electronAPI } from "@/services/electronAPI";

export interface Note {
  id: number;
  content: string;
  tags?: string;
  summary?: string;
  insight?: string;
  color?: string;
  created_at?: string;
}

export interface GraphNode {
  id: number;
  label: string;
  color: string;
}

export interface GraphEdge {
  from: number | string;
  to: number | string;
  label?: string;
}

export function useKnowledgeGraph() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);

  useEffect(() => {
    (async () => {
      const allNotes: Note[] = await electronAPI.searchNote({ query: "" });
      setNotes(allNotes);

      const nodeList: GraphNode[] = allNotes.map((note: Note) => ({
        id: note.id,
        label: note.tags || `Note ${note.id}`,
        color: note.color || "#6366f1",
      }));

      const edgeList: GraphEdge[] = [];

      for (const note of allNotes) {
        try {
          if (note.insight) {
            const insight = JSON.parse(note.insight);
            if (Array.isArray(insight.connections)) {
              for (const conn of insight.connections as string[]) {
                const target = allNotes.find(
                  (n: Note) =>
                    n.content.includes(conn) ||
                    (n.tags && n.tags.includes(conn))
                );
                if (target && target.id !== note.id) {
                  edgeList.push({
                    from: note.id,
                    to: target.id,
                    label: "related",
                  });
                }
              }
            }
          }
        } catch (e) {
          console.warn("[Graph] parse insight failed", e);
        }
      }

      setNodes(nodeList);
      setEdges(edgeList);
    })();
  }, []);

  return { notes, nodes, edges };
}
