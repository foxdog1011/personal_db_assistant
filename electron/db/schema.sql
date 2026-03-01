import React, { useEffect, useRef, useState } from "react";
import { Network } from "vis-network";
import { DataSet } from "vis-data";
import "vis-network/styles/vis-network.css";
import { electronAPI } from "@/services/electronAPI";

/* ---------- 型別宣告 ---------- */
declare module "vis-network" {
  interface Network {
    getConnectedNodes(nodeId: string | number): (string | number)[];
    focus(
      nodeId: string | number,
      options?: {
        scale?: number;
        offset?: { x?: number; y?: number };
        animation?: { duration?: number; easingFunction?: string };
      }
    ): void;
  }
}

interface GraphNode {
  id: string | number;
  label: string;
  color?: string;
  font?: any;
}

interface GraphEdge {
  id?: string | number;
  from: string | number;
  to: string | number;
  label?: string;
  arrows?: string;
  color?: any;
  font?: any;
}

interface Note {
  id: number;
  content: string;
  summary?: string;
  tags?: string;
}

/* 🎨 顏色分群 */
const getColor = (label: string): string => {
  const lower = label.toLowerCase();
  if (lower.includes("ai") || lower.includes("model")) return "#a78bfa"; // 紫
  if (lower.includes("cloud") || lower.includes("aws") || lower.includes("azure")) return "#38bdf8"; // 藍
  if (lower.includes("data") || lower.includes("sql")) return "#34d399"; // 綠
  if (lower.includes("security") || lower.includes("guard")) return "#f87171"; // 紅
  return "#9ca3af";
};

/* ---------- 主元件 ---------- */
export default function GraphPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const nodesRef = useRef(new DataSet<GraphNode>([]));
  const edgesRef = useRef(new DataSet<GraphEdge>([]));
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [tooltip, setTooltip] = useState<any>(null);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  /* ---------- 建立圖資料 ---------- */
  const buildGraphData = (data: any) => {
    const nodes: GraphNode[] = (data.nodes || []).map((n: any) => ({
      id: n.id,
      label: n.label || "未命名節點",
      color: getColor(n.label || ""),
      font: { color: "#fff", size: 14 },
    }));

    const edges: GraphEdge[] = (data.links || []).map((l: any) => ({
      from: l.source,
      to: l.target,
      label: l.label || "",
      arrows: "to",
      color: { color: "rgba(255,255,255,0.25)" },
      font: { color: "#aaa", size: 11 },
    }));

    return { nodes, edges };
  };

  /* ---------- 初始化 vis-network ---------- */
  const initNetwork = () => {
    if (!containerRef.current || networkRef.current) return;

    const options = {
      physics: {
        enabled: true,
        barnesHut: {
          gravitationalConstant: -4000,
          centralGravity: 0.25,
          springLength: 180,
        },
      },
      nodes: {
        shape: "dot",
        size: 18,
        borderWidth: 1.5,
        color: {
          border: "rgba(255,255,255,0.3)",
          highlight: { border: "#fff" },
        },
        font: { size: 14, color: "#fff" },
      },
      edges: {
        width: 1.2,
        smooth: { type: "continuous" },
        color: { color: "rgba(255,255,255,0.25)", highlight: "#fff" },
      },
      interaction: { hover: true, zoomView: true, dragView: true },
    };

    const net = new Network(
      containerRef.current,
      { nodes: nodesRef.current, edges: edgesRef.current },
      options
    );
    networkRef.current = net;

    /* 點擊節點 */
    net.on("click", async (params: any) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const notes = await electronAPI.searchNote({ query: String(nodeId) });
        setActiveNote(notes?.[0] || { id: 0, content: "找不到筆記內容", tags: "" });
        setEditingNote(null);
      }
    });

    /* hover 顯示摘要 */
    net.on("hoverNode", async (params: any) => {
      const nodeId = params.node;
      const rect = containerRef.current!.getBoundingClientRect();
      const x = params.pointer.DOM.x + rect.left + 25;
      const y = params.pointer.DOM.y + rect.top - 10;
      const notes = await electronAPI.searchNote({ query: String(nodeId) });
      const note = notes?.[0];
      const summary =
        note?.summary || note?.content?.slice(0, 100) + "..." || "暫無摘要";
      setTooltip({
        x,
        y,
        node: String(nodeId),
        summary,
        tags: note?.tags?.split(",").filter(Boolean),
      });
    });

    net.on("blurNode", () => setTooltip(null));
  };

  /* ---------- 載入資料 ---------- */
  const refreshGraph = async () => {
    setLoading(true);
    try {
      const data = await electronAPI.getKnowledgeGraph();
      const { nodes, edges } = buildGraphData(data || {});
      nodesRef.current.clear();
      edgesRef.current.clear();
      nodesRef.current.add(nodes);
      edgesRef.current.add(edges);
      initNetwork();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshGraph();
  }, []);

  /* ---------- UI ---------- */
  return (
    <div className="relative min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-800 text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full flex items-center justify-between px-8 py-4 bg-white/60 dark:bg-gray-900/40 backdrop-blur-2xl border-b border-white/20 shadow-[0_4px_30px_rgba(0,0,0,0.05)] z-50">
        <div className="flex items-center gap-2">
          <span className="text-pink-400 text-2xl drop-shadow-[0_0_6px_rgba(236,72,153,0.6)]">
            🧠
          </span>
          <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]">
            Knowledge Graph
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="🔍 搜尋節點..."
            className="px-4 py-2 rounded-full text-gray-800 text-sm bg-white/70 border border-gray-300 shadow-inner focus:ring-2 focus:ring-indigo-400 focus:outline-none w-56"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && refreshGraph()}
          />
          <button
            onClick={() => (window.location.hash = '#/')}
            className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-medium rounded-full shadow-md hover:shadow-[0_0_12px_rgba(139,92,246,0.6)] transition"
          >
            ← 返回筆記
          </button>
        </div>
      </header>

      {/* Graph 容器 */}
      <div
        ref={containerRef}
        className="rounded-3xl border border-white/10 shadow-inner mt-[72px]"
        style={{
          width: "100%",
          height: "calc(100vh - 72px)",
          background: "radial-gradient(circle at 50% 30%, #111827 0%, #030712 100%)",
        }}
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed bg-gray-900/85 backdrop-blur-md border border-indigo-400/30 rounded-xl shadow-xl px-4 py-3 w-72 z-50"
          style={{ left: tooltip.x, top: tooltip.y, pointerEvents: "none" }}
        >
          <h3 className="text-sm font-semibold text-indigo-300 mb-1">
            🧩 {tooltip.node}
          </h3>
          <p className="text-xs text-gray-300">{tooltip.summary}</p>
        </div>
      )}

      {/* Loading Spinner */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-400" />
        </div>
      )}
    </div>
  );
}
