import { useCallback, useState } from "react";
import { ipc } from "@/services/electronIpc";

export function useGraph() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });

  const loadGraph = useCallback(async () => {
    setLoading(true);
    try {
      const g = await ipc.getKnowledgeGraph();
      setData(g || { nodes: [], links: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  const rebuildGraph = useCallback(() => ipc.rebuildRelations(), []);

  const resetView = useCallback(() => {
    setData({ nodes: [], links: [] });
  }, []);

  return { loading, data, loadGraph, rebuildGraph, resetView };
}
