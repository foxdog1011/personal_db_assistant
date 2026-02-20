import React, { useEffect, useRef, useMemo } from "react";
import { Network } from "vis-network";
import type { DataSet } from "vis-data";
import "vis-network/styles/vis-network.css";
import type { GraphNode, GraphEdge as BaseEdge } from "../hooks/useKnowledgeGraph";

/* =====================================================
 * 🧩 型別補丁 — 避免衝突 & 強化可視化屬性
 * ===================================================== */
export interface GraphEdge extends BaseEdge {
  id?: string | number; // ✅ vis-network DataSet 需要 id 屬性
  /** concept_relations.id — used by EdgeEvidencePanel */
  relationId?: string;
}

type ExtendedGraphNode = GraphNode & {
  connections?: number;
  color?:
    | string
    | {
        background: string;
        border: string;
        highlight?: { background: string; border: string };
      };
};

// ✅ 單一全域宣告，避免多檔案衝突
declare global {
  interface VisNetworkBody {
    data: {
      nodes: DataSet<ExtendedGraphNode>;
      edges: DataSet<GraphEdge>;
    };
  }
}

declare module "vis-network" {
  interface Network {
    destroy(): void;
    on(event: string, callback: (...args: any[]) => void): void;
    once?(event: string, callback: (...args: any[]) => void): void;
    focus?(nodeId: string | number, options?: any): void;
    canvas?: { body?: { container?: HTMLElement } };
    body: VisNetworkBody;
  }
}

/* =====================================================
 * 🧱 Props
 * ===================================================== */
interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSelectNode: (id: number) => void;
  /** Called when an edge is clicked; receives (relationId, fromLabel, toLabel) */
  onSelectEdge?: (relationId: string, fromLabel: string, toLabel: string) => void;
  mode?: "triples" | "relations" | "concept" | "insight";
  /** When set, find the node whose label matches and focus the camera on it */
  focusNodeLabel?: string;
}

/* =====================================================
 * 🧠 主組件
 * ===================================================== */
const KnowledgeGraph: React.FC<Props> = ({
  nodes,
  edges,
  onSelectNode,
  onSelectEdge,
  mode = "relations",
  focusNodeLabel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);

  /* =====================================================
   * 🧮 Hash 避免 useEffect 不穩定觸發
   * ===================================================== */
  const graphHash = useMemo(
    () => `${nodes.length}-${edges.length}-${mode}`,
    [nodes.length, edges.length, mode]
  );

  /* =====================================================
   * 🎨 模式顏色
   * ===================================================== */
  const modeColorMap = useMemo(
    () => ({
      relations: "#60a5fa",
      triples: "#34d399",
      concept: "#a78bfa",
      insight: "#f472b6",
    }),
    []
  );

  /* =====================================================
   * 🧠 初始化 Network
   * ===================================================== */
  useEffect(() => {
    if (!containerRef.current) return;

    const network = new Network(
      containerRef.current,
      { nodes, edges },
      {
        nodes: {
          shape: "dot",
          size: 16,
          borderWidth: 1.5,
          font: { color: "#fff", size: 14, face: "Inter" },
        },
        edges: {
          color: { color: "rgba(255,255,255,0.3)", highlight: "#fff" },
          smooth: { type: "continuous" },
        },
        layout: { improvedLayout: true },
        physics: {
          enabled: true,
          barnesHut: { gravitationalConstant: -5000, centralGravity: 0.3 },
        },
        interaction: { hover: true, zoomView: true, dragView: true },
      }
    );

    /* 🖱 節點點擊 */
    network.on("selectNode", (params: any) => {
      const rawId = params.nodes?.[0];
      if (!rawId) return;
      const node = (network.body.data.nodes as any).get(rawId) as ExtendedGraphNode;
      const nodeId = typeof node?.id === "number" ? node.id : rawId;
      if (!isNaN(Number(nodeId))) onSelectNode(Number(nodeId));
    });

    /* 🔗 Edge 點擊 → EdgeEvidencePanel */
    network.on("selectEdge", (params: any) => {
      if (!onSelectEdge || !params.edges?.length) return;
      const edgeVizId = params.edges[0];
      const edge = (network.body.data.edges as any).get(edgeVizId) as GraphEdge;
      if (!edge?.relationId) return;
      onSelectEdge(edge.relationId, String(edge.from), String(edge.to));
    });

    /* 🧠 hover 提示 */
    network.on("hoverNode", (params: any) => {
      const node = (network.body.data.nodes as any).get(params.node);
      if (containerRef.current) containerRef.current.style.cursor = "pointer";
      const container = network.canvas?.body?.container;
      if (container) container.title = node?.label || "";
    });

    network.on("blurNode", () => {
      if (containerRef.current) containerRef.current.style.cursor = "default";
    });

    /* 🔍 聚焦主節點 */
    network.once?.("stabilized", () => {
      const mainId = nodes[0]?.id;
      if (mainId) {
        network.focus?.(mainId, {
          scale: 1.2,
          animation: { duration: 700, easingFunction: "easeInOutQuad" },
        });
      }
    });

    networkRef.current = network;
    return () => network.destroy();
  }, []); // mount only

  /* =====================================================
   * 🔁 更新資料
   * ===================================================== */
  useEffect(() => {
    if (!networkRef.current) return;
    const { nodes: nodeDataset, edges: edgeDataset } =
      networkRef.current.body.data;

    nodeDataset.clear();
    edgeDataset.clear();

    const color = modeColorMap[mode] || "#6366f1";

    const enrichedNodes = nodes.map((n) => ({
      ...n,
      size: Math.min(30, 10 + ((n as any).connections || 0) * 2),
      color: {
        background: color,
        border: "#fff",
        highlight: { background: "#fef3c7", border: "#facc15" },
      } as any,
    }));

    nodeDataset.add(enrichedNodes as any);
    edgeDataset.add(edges as any); // ✅ 修正 GraphEdge 沒有 id

    containerRef.current?.animate([{ opacity: 0.6 }, { opacity: 1 }], {
      duration: 500,
      easing: "ease-in-out",
    });

    console.debug(`[DEBUG] Graph updated (${mode})`);
  }, [graphHash]);

  /* =====================================================
   * 🔍 外部搜尋聚焦：focusNodeLabel 變化時移動鏡頭
   * ===================================================== */
  useEffect(() => {
    if (!focusNodeLabel || !networkRef.current) return;
    const { nodes: nodeDataset } = networkRef.current.body.data;
    const all = (nodeDataset as any).get() as ExtendedGraphNode[];
    const match = all.find(
      (n) => n.label?.toLowerCase() === focusNodeLabel.toLowerCase()
    );
    if (match) {
      networkRef.current.focus?.(match.id as string | number, {
        scale: 1.8,
        animation: { duration: 600, easingFunction: "easeInOutQuad" },
      });
    }
  }, [focusNodeLabel]);

  /* =====================================================
   * 🧱 Render
   * ===================================================== */
  return (
    <div
      ref={containerRef}
      className="h-[80vh] w-full rounded-2xl border border-gray-700 shadow-inner 
      bg-gradient-to-b from-gray-950 via-gray-900 to-gray-800 transition-all duration-500"
    />
  );
};

export default KnowledgeGraph;
