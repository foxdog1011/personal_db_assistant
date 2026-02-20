import React, { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import KnowledgeGraph from "@/features/graph/components/KnowledgeGraph";
import { EdgeEvidencePanel } from "@/features/graph/components/EdgeEvidencePanel";
import { useGraphData } from "@/features/graph/hooks/useGraphData";
import { ipc } from "@/services/electronIpc";
import type { GraphQueryParams } from "@/types/electron-api";
import { Input } from "@/features/common/ui/Input";
import { Slider } from "@/features/common/ui/Slider";
import { Button } from "@/features/common/ui/Button";
import { Modal } from "@/features/common/ui/Modal";

type GraphMode = "relations" | "triples" | "concept" | "insight";

const GraphPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  // URL: /graph?noteId=5  → "This Note" filter active on mount — kept as string throughout
  const urlNoteId = searchParams.get("noteId"); // string | null

  const [viewMode, setViewMode] = useState<GraphMode>("triples");
  const [noteFilter, setNoteFilter] = useState<string | null>(urlNoteId);
  const [minWeight, setMinWeight] = useState(0);
  const [nodeSearch, setNodeSearch] = useState("");
  const [focusLabel, setFocusLabel] = useState("");
  const [insight, setInsight] = useState<string | null>(null);
  const [depth, setDepth] = useState<1 | 2>(1);
  const [minSupportingNotes, setMinSupportingNotes] = useState(1);
  const [minSupportCount] = useState(1); // note-mode param; no slider yet (default: show all)
  const [selectedEdge, setSelectedEdge] = useState<{
    relationId: string;
    fromLabel: string;
    toLabel: string;
  } | null>(null);

  // Derive graph scope from noteFilter — null/empty → global
  const graphMode: "note" | "global" = noteFilter ? "note" : "global";

  const queryParams = useMemo<GraphQueryParams>(() => ({
    mode: graphMode,
    noteId: graphMode === "note" ? (noteFilter ?? undefined) : undefined,
    depth,
    limit: 200,
    minSupportCount: graphMode === "note" ? minSupportCount : undefined,
    minSupportingNotes: graphMode === "global" ? minSupportingNotes : undefined,
  }), [graphMode, noteFilter, depth, minSupportCount, minSupportingNotes]);

  const { graph, mode, loading, rebuild } = useGraphData(queryParams);

  // Apply minWeight filter (relations mode only — triples have no numeric weight)
  const filteredEdges = useMemo(() => {
    if (mode !== "relations" || minWeight <= 0) return graph.edges;
    return graph.edges.filter((e) => (e.weight ?? 1) >= minWeight);
  }, [graph.edges, mode, minWeight]);

  /* 🧠 節點點擊事件 */
  const handleSelectNode = async (id: number) => {
    if (!id) return;
    try {
      if (viewMode === "insight") {
        const res = await ipc.generateInsight({ id, content: "" });
        setInsight(res?.insight || "（AI 洞察生成失敗）");
      } else {
        const res = await ipc.getNoteContent({ id });
        alert(`📝 筆記內容：\n${res.note?.content || "找不到筆記內容"}`);
      }
    } catch (err) {
      console.error("[GraphPage] handleSelectNode error:", err);
    }
  };

  /* 🔁 模式循環切換 */
  const cycleMode = () => {
    setViewMode((prev) =>
      prev === "relations"
        ? "triples"
        : prev === "triples"
        ? "concept"
        : prev === "concept"
        ? "insight"
        : "relations"
    );
  };

  /* 🏷 模式中文標籤 */
  const modeLabel =
    viewMode === "relations"
      ? "關聯網路"
      : viewMode === "triples"
      ? "三元組"
      : viewMode === "concept"
      ? "概念關聯"
      : "AI 洞察";

  /* 🔍 節點搜尋：Enter 觸發聚焦 */
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setFocusLabel(nodeSearch.trim());
    }
  };

  /* 🧱 Render */
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-800 text-white">
      {/* 🧭 Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-gray-950/80 backdrop-blur-md border-b border-white/10 gap-4 flex-wrap">
        <h1 className="text-lg font-semibold shrink-0">🧠 知識圖譜</h1>

        {/* Controls row */}
        <div className="flex items-center gap-2 flex-wrap flex-1 justify-end">

          {/* 🔍 節點搜尋 */}
          <Input
            value={nodeSearch}
            onChange={(e) => setNodeSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="搜尋節點 (Enter 聚焦)"
            prefixIcon={<span className="text-xs">🔍</span>}
            className="w-44 bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:ring-indigo-500"
          />

          {/* 🎯 This Note 切換 */}
          {urlNoteId && (
            <button
              onClick={() =>
                setNoteFilter((prev) => (prev ? null : urlNoteId))
              }
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                noteFilter
                  ? "bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-semibold"
                  : "bg-gray-700 hover:bg-gray-600 text-gray-300"
              }`}
              title={`筆記 #${urlNoteId} 的子圖`}
            >
              {noteFilter ? "📌 This Note" : "📌 全部圖譜"}
            </button>
          )}

          {/* 🔗 minSupportingNotes slider (triples global mode only) */}
          {viewMode === "triples" && !noteFilter && (
            <Slider
              min={1}
              max={5}
              step={1}
              value={minSupportingNotes}
              onChange={(e) => setMinSupportingNotes(parseInt(e.target.value, 10))}
              label={<span className="text-gray-300 text-sm">共現 ≥</span>}
              valueDisplay={minSupportingNotes}
              title="最少需有幾篇 note 同時出現這條 canonical edge"
              className="shrink-0 w-36"
            />
          )}

          {/* 🔢 Depth toggle (triples mode + note filter only) */}
          {viewMode === "triples" && noteFilter && (
            <button
              onClick={() => setDepth((d) => (d === 1 ? 2 : 1))}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                depth === 2
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : "bg-gray-700 hover:bg-gray-600 text-gray-300"
              }`}
              title="跳數切換 (1=直接關聯, 2=二階關聯)"
            >
              深度 {depth}
            </button>
          )}

          {/* ⚖️ minWeight 滑桿 (relations mode only) */}
          {mode === "relations" && (
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={minWeight}
              onChange={(e) => setMinWeight(parseFloat(e.target.value))}
              label={<span className="text-gray-300 text-sm">min</span>}
              valueDisplay={minWeight.toFixed(2)}
              className="shrink-0 w-36"
            />
          )}

          {/* 模式切換 */}
          <Button
            variant="primary"
            size="sm"
            onClick={cycleMode}
          >
            {modeLabel}
          </Button>

          {/* 重建圖譜 */}
          <Button
            variant="neutral"
            size="sm"
            onClick={rebuild}
            disabled={loading}
            className="bg-amber-500 hover:bg-amber-400 text-white disabled:opacity-50"
          >
            {loading ? "重建中..." : "重建關聯"}
          </Button>

          {/* 查看演化 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (window.location.hash = "#/graph-evolution")}
            className="border-purple-500/50 text-purple-300 hover:bg-purple-900/30"
          >
            🪄 演化
          </Button>

          {/* 返回筆記 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (window.location.hash = "#/")}
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            ← 返回
          </Button>
        </div>
      </header>

      {/* Stats bar */}
      <div className="px-6 py-1.5 bg-gray-900/60 border-b border-white/5 text-xs text-gray-400 flex gap-4">
        <span>節點 {graph.nodes.length}</span>
        <span>
          邊 {filteredEdges.length}
          {filteredEdges.length !== graph.edges.length
            ? ` / ${graph.edges.length}`
            : ""}
        </span>
        {noteFilter && (
          <span className="text-yellow-400">筆記 #{noteFilter} 子圖</span>
        )}
      </div>

      {/* 🧩 Graph 區 */}
      <main className="p-4">
        {loading ? (
          <div className="flex items-center justify-center h-[78vh] text-gray-400 animate-pulse">
            ⏳ 正在載入圖譜...
          </div>
        ) : graph.nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[78vh] text-gray-500 gap-3">
            <span className="text-4xl">🕸️</span>
            <p>尚無圖譜資料</p>
            <p className="text-xs">新增筆記後，worker 會自動抽取三元組</p>
            <Button
              variant="neutral"
              size="sm"
              onClick={rebuild}
              className="mt-2 bg-amber-500 hover:bg-amber-400 text-white"
            >
              手動重建關聯
            </Button>
          </div>
        ) : (
          <KnowledgeGraph
            nodes={graph.nodes}
            edges={filteredEdges}
            mode={viewMode}
            onSelectNode={handleSelectNode}
            onSelectEdge={(relationId, fromLabel, toLabel) =>
              setSelectedEdge({ relationId, fromLabel, toLabel })
            }
            focusNodeLabel={focusLabel}
          />
        )}
      </main>

      {/* 💬 AI 洞察面板 */}
      {viewMode === "insight" && insight && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900/90 border-t border-gray-700 p-4 text-sm max-h-48 overflow-y-auto backdrop-blur-md">
          <h2 className="font-semibold mb-2">🧠 AI 洞察</h2>
          <p className="text-gray-300 whitespace-pre-wrap">{insight}</p>
        </div>
      )}

      {/* 🔗 Edge Evidence Panel */}
      {selectedEdge && (
        <Modal open={!!selectedEdge} onClose={() => setSelectedEdge(null)}>
          <EdgeEvidencePanel
            relationId={selectedEdge.relationId}
            fromLabel={selectedEdge.fromLabel}
            toLabel={selectedEdge.toLabel}
            onClose={() => setSelectedEdge(null)}
          />
        </Modal>
      )}
    </div>
  );
};

export default GraphPage;
