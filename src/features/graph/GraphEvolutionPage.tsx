import React, { useEffect, useRef, useState } from "react";
import { Network } from "vis-network";
import { DataSet } from "vis-data";
import "vis-network/styles/vis-network.css";
import ipc from "@/services/electronAPI"; // ✅ 改成 ipc（你匯出的是 default）

// 💡 擴充 vis-network 型別（補上未定義的方法）
declare module "vis-network" {
  interface Network {
    getPositions(nodes?: (string | number)[]): Record<string, { x: number; y: number }>;
    moveTo(options: {
      position?: { x: number; y: number };
      scale?: number;
      offset?: { x: number; y: number };
    }): void;
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
}
interface GraphStep {
  step: number;
  head: string;
  relation: string;
  tail: string;
  created_at?: string;
}

export default function GraphEvolutionPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const nodesRef = useRef(new DataSet<GraphNode>());
  const edgesRef = useRef(new DataSet<GraphEdge>());

  const [steps, setSteps] = useState<GraphStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1200);

  /** 🧩 初始化畫布 */
  const initNetwork = () => {
    if (!containerRef.current) return;
    const net = new Network(
      containerRef.current,
      { nodes: nodesRef.current, edges: edgesRef.current },
      {
        physics: {
          enabled: true,
          barnesHut: { gravitationalConstant: -2500 },
        },
        nodes: {
          shape: "dot",
          size: 18,
          font: { color: "#fff", size: 14 },
        },
        edges: {
          width: 1.2,
          color: { color: "rgba(255,255,255,0.25)" },
          smooth: true,
        },
        interaction: {
          hover: true,
          zoomView: true,
          dragView: true,
        },
      }
    );
    networkRef.current = net;
  };

  /** 📥 取得演化步驟資料 */
  const loadEvolution = async () => {
    try {
      const res = await ipc.getGraphEvolution();
      if (res?.steps) setSteps(res.steps);
      else console.warn("⚠️ 無演化資料");
    } catch (err) {
      console.error("❌ getGraphEvolution 失敗:", err);
    }
  };

  /** 🎬 播放動畫 */
  const playEvolution = async () => {
    if (!steps.length) return;
    setIsPlaying(true);

    for (let i = currentStep; i < steps.length; i++) {
      const s = steps[i];

      // 若節點不存在則新增
      if (!nodesRef.current.get(s.head))
        nodesRef.current.add({ id: s.head, label: s.head, color: "#38bdf8" });
      if (!nodesRef.current.get(s.tail))
        nodesRef.current.add({ id: s.tail, label: s.tail, color: "#a78bfa" });

      // 新增邊
      const edgeId = `${s.head}-${s.tail}`;
      if (!edgesRef.current.get(edgeId)) {
        edgesRef.current.add({
          id: edgeId,
          from: s.head,
          to: s.tail,
          label: s.relation,
          arrows: "to",
          color: { color: "#f472b6" },
        });
      }

      // ✨ 高亮目前的節點與邊
      nodesRef.current.updateOnly([{ id: s.tail, color: "#facc15" }]); // 黃色高亮
      edgesRef.current.updateOnly([{ id: edgeId, color: { color: "#fbbf24" } }]);

      const net = networkRef.current;
      if (net) {
        const pos = net.getPositions([s.tail])[s.tail];
        if (pos) net.moveTo({ position: pos, scale: 1.4 });
      }

      setCurrentStep(i + 1);
      await new Promise((r) => setTimeout(r, speed));

      // 💫 還原顏色
      nodesRef.current.updateOnly([{ id: s.tail, color: "#a78bfa" }]);
      edgesRef.current.updateOnly([{ id: edgeId, color: { color: "#f472b6" } }]);
    }

    setIsPlaying(false);
  };

  useEffect(() => {
    initNetwork();
    loadEvolution();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-800 text-white">
      {/* 🧭 頂部導覽 */}
      <header className="flex items-center justify-between px-8 py-4 bg-gray-950/80 backdrop-blur-md border-b border-white/10">
        <h1 className="text-lg font-semibold">🪄 知識演化視覺化</h1>
        <button
          onClick={() => (window.location.hash = "#/graph")}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
        >
          ← 返回知識圖
        </button>
      </header>

      {/* 🧠 Graph 畫布 */}
      <div
        ref={containerRef}
        className="rounded-3xl border border-white/10 mt-[72px]"
        style={{
          width: "100%",
          height: "calc(100vh - 72px)",
          background:
            "radial-gradient(circle at 50% 30%, #0f172a 0%, #020617 100%)",
        }}
      />

      {/* 🎛 控制面板 */}
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4 bg-gray-900/70 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-lg z-50">
        <button
          onClick={playEvolution}
          disabled={isPlaying || !steps.length}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm"
        >
          {isPlaying ? "播放中..." : "▶ 播放演化"}
        </button>

        <div className="flex items-center text-gray-300 text-sm">
          Step: {currentStep} / {steps.length}
        </div>

        <label className="flex items-center text-sm text-gray-400">
          速度：
          <input
            type="range"
            min="300"
            max="3000"
            step="100"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="ml-2 accent-indigo-400"
          />
        </label>
      </div>
    </div>
  );
}
