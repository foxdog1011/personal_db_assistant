import React, {
  useEffect, useState, useCallback, useMemo, useRef,
} from "react";
import type { RelatedNote, SemanticNote } from "@/types/electron-api";
import { Badge } from "@/features/common/ui/Badge";
import { Button } from "@/features/common/ui/Button";
import { Tabs } from "@/features/common/ui/Tabs";
import { Input } from "@/features/common/ui/Input";
import { Slider } from "@/features/common/ui/Slider";
import { Chip } from "@/features/common/ui/Chip";

// ── Types ─────────────────────────────────────────────────────────────────────
type ActiveTab = "graph" | "semantic" | "hybrid";
type SortOrder = "score_desc" | "score_asc";

interface PanelNote {
  noteId: string;
  title: string;
  score: number;
  sharedTerms?: string[];
  /** Stored for hybrid slider re-sort without re-fetch */
  graphScoreNorm?: number;
  semanticScoreNorm?: number;
}

// ── Exported utils ────────────────────────────────────────────────────────────

export function formatSnippet(text: string): string {
  const s = (text || "").trim();
  if (!s) return "（無標題）";
  return s.length > 40 ? `${s.slice(0, 40)}…` : s;
}

export function formatCopyText(tab: ActiveTab, item: PanelNote): string {
  const detail =
    tab !== "semantic" && item.sharedTerms && item.sharedTerms.length > 0
      ? `共享：${item.sharedTerms.join("、")}`
      : `相似：${item.score.toFixed(3)}`;
  return `筆記 #${item.noteId}: ${formatSnippet(item.title)}（${detail}）`;
}

export function renderChips(list: string[], max = 12): string[] {
  return list.slice(0, max);
}

/** Wrap the first occurrence of `query` in `text` with `<mark>`. */
export function renderHighlight(text: string, query: string): React.ReactNode {
  const q = query.trim().toLowerCase();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-700 text-gray-900 dark:text-white rounded-sm px-0.5">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

// ── RelatedNoteCard (internal) ────────────────────────────────────────────────

interface NoteCardProps {
  item: PanelNote;
  tab: ActiveTab;
  isActive: boolean;
  searchQuery: string;
  isPinned: boolean;
  onMouseEnter: () => void;
  onNavigate: (noteId: string) => void;
  onCopy: (item: PanelNote) => void;
  onPin: (noteId: string) => void;
}

const RelatedNoteCard = React.forwardRef<HTMLLIElement, NoteCardProps>(
  function RelatedNoteCard(
    { item, tab, isActive, searchQuery, isPinned, onMouseEnter, onNavigate, onCopy, onPin },
    ref
  ) {
    const [showExplain, setShowExplain] = useState(true);

    // Score bar: graph uses raw integer (÷10), semantic/hybrid are already 0..1
    const normalized =
      tab === "graph"
        ? Math.max(0, Math.min(1, item.score / 10))
        : Math.max(0, Math.min(1, item.score));
    const barWidth = Math.round(normalized * 100) + "%";
    const chips = renderChips(item.sharedTerms || []);

    const scoreLabel =
      tab === "graph"
        ? `共現 ${item.score}`
        : tab === "hybrid"
        ? `混合 ${item.score.toFixed(3)}`
        : `相似 ${item.score.toFixed(3)}`;

    // Action buttons visible when: card is active, is pinned, or group-hover
    const actionsVisible = isActive || isPinned;

    return (
      <li
        ref={ref}
        data-testid={`card-note-${item.noteId}`}
        data-active={String(isActive)}
        onMouseEnter={onMouseEnter}
        onClick={() => onNavigate(item.noteId)}
        className={[
          "rounded-xl border cursor-pointer select-none transition-all duration-150 group",
          isActive
            ? "border-indigo-500 ring-2 ring-indigo-400/40 bg-indigo-50 dark:bg-indigo-950/40 shadow-sm"
            : "border-gray-200 dark:border-gray-700/70 bg-white dark:bg-gray-900 hover:border-indigo-200 dark:hover:border-indigo-700 hover:shadow-sm hover:ring-1 hover:ring-indigo-200/60 dark:hover:ring-indigo-700/40",
        ].join(" ")}
      >
        {/* ── Main row: content (left) + score bar (right) ─────── */}
        <div className="flex items-stretch gap-3 px-3.5 pt-3.5 pb-2.5">

          {/* Left: title + snippet */}
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            {/* Title row + action buttons */}
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-gray-900 dark:text-white truncate flex-1 leading-tight">
                筆記 #{renderHighlight(item.noteId, searchQuery)}
              </span>

              {/* Action buttons — slide in on active/hover */}
              <div
                className={`flex items-center gap-0.5 shrink-0 transition-opacity duration-150 ${
                  actionsVisible ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                <button
                  data-testid={`pin-${item.noteId}`}
                  onClick={(e) => { e.stopPropagation(); onPin(item.noteId); }}
                  className={`p-1 rounded-md text-xs transition-colors ${
                    isPinned
                      ? "text-amber-500 bg-amber-50 dark:bg-amber-900/30"
                      : "text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                  }`}
                  title={isPinned ? "取消錨點" : "從此筆記展開"}
                >
                  📌
                </button>
                <button
                  data-testid={`toggle-explain-${item.noteId}`}
                  onClick={(e) => { e.stopPropagation(); setShowExplain((v) => !v); }}
                  className="p-1 rounded-md text-xs text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                  title={showExplain ? "收起說明" : "展開說明"}
                >
                  {showExplain ? "▲" : "▼"}
                </button>
                <button
                  data-testid={`copy-${item.noteId}`}
                  onClick={(e) => { e.stopPropagation(); onCopy(item); }}
                  aria-label={`複製筆記 #${item.noteId}`}
                  title="複製"
                  className="p-1 rounded-md text-xs text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                >
                  📋
                </button>
              </div>
            </div>

            {/* Snippet */}
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
              {renderHighlight(formatSnippet(item.title), searchQuery)}
            </p>
          </div>

          {/* Right: score label + horizontal bar */}
          <div className="flex flex-col items-end justify-between shrink-0 w-16 gap-1.5">
            <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
              {scoreLabel}
            </span>
            <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                data-testid={`scorebar-${item.noteId}`}
                className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full transition-all duration-200"
                style={{ width: barWidth }}
              />
            </div>
          </div>
        </div>

        {/* ── Expandable section ────────────────────────────────── */}
        {showExplain && (chips.length > 0 || tab === "hybrid") && (
          <div className="px-3.5 pb-3 pt-1 border-t border-gray-100 dark:border-gray-800/80 space-y-2">

            {/* Chips */}
            {chips.length > 0 && (
              <div
                data-testid={`chips-${item.noteId}`}
                className="flex flex-wrap gap-1.5"
              >
                {chips.map((t) => (
                  <Chip key={t}>{renderHighlight(t, searchQuery)}</Chip>
                ))}
              </div>
            )}

            {/* Hybrid source badges */}
            {tab === "hybrid" && (
              <div
                data-testid={`hybrid-breakdown-${item.noteId}`}
                className="flex gap-2"
              >
                {item.graphScoreNorm !== undefined && (
                  <Badge
                    label={`圖譜 ${Math.round(item.graphScoreNorm * 100)}%`}
                    variant="graph"
                    data-testid={`badge-graph-${item.noteId}`}
                  />
                )}
                {item.semanticScoreNorm !== undefined && (
                  <Badge
                    label={`語意 ${Math.round(item.semanticScoreNorm * 100)}%`}
                    variant="semantic"
                    data-testid={`badge-semantic-${item.noteId}`}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </li>
    );
  }
);

// ── Panel ─────────────────────────────────────────────────────────────────────

interface Props {
  noteId: number;
  onClose: () => void;
}

export function RelatedNotesPanel({ noteId, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("graph");
  const [rawItems, setRawItems] = useState<PanelNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [topK, setTopK] = useState(5);
  const [sortBy, setSortBy] = useState<SortOrder>("score_desc");
  /** 0 = all graph, 1 = all semantic; slider only re-sorts, never re-fetches */
  const [semanticWeight, setSemanticWeight] = useState(0.6);
  const [pinnedNoteId, setPinnedNoteId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  const effectiveNoteId = pinnedNoteId ?? noteId.toString();

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setActiveIndex(-1);
    setError(null);
    setLoading(true);
    try {
      if (activeTab === "graph") {
        const res = await window.electronAPI.getRelatedNotes({
          noteId: effectiveNoteId,
          k: topK,
        });
        setRawItems(
          (res.related || []).map((r: RelatedNote) => ({
            noteId: r.noteId,
            title: r.title,
            score: r.score,
            sharedTerms: r.sharedTerms,
          }))
        );
      } else if (activeTab === "semantic") {
        const res = await window.electronAPI.getSemanticNotes({
          noteId: effectiveNoteId,
          k: topK,
        });
        setRawItems(
          (res.related || []).map((r: SemanticNote) => ({
            noteId: r.noteId,
            title: r.title,
            score: r.score,
          }))
        );
      } else {
        // hybrid: fetch both APIs in parallel, merge by noteId
        const [graphRes, semRes] = await Promise.all([
          window.electronAPI.getRelatedNotes({ noteId: effectiveNoteId, k: topK }),
          window.electronAPI.getSemanticNotes({ noteId: effectiveNoteId, k: topK }),
        ]);

        const map = new Map<string, { graph?: RelatedNote; semantic?: SemanticNote }>();
        for (const g of (graphRes.related || [])) {
          map.set(g.noteId, { graph: g });
        }
        for (const s of (semRes.related || [])) {
          const existing = map.get(s.noteId);
          map.set(s.noteId, existing ? { ...existing, semantic: s } : { semantic: s });
        }

        const combined: PanelNote[] = [];
        for (const [nId, { graph, semantic }] of map) {
          const title = graph?.title || semantic?.title || "";
          // undefined = source did not contribute; lets badge conditions use !== undefined
          const graphScoreNorm = graph ? Math.min(graph.score / 10, 1) : undefined;
          const semanticScoreNorm = semantic ? Math.min(semantic.score, 1) : undefined;
          combined.push({
            noteId: nId,
            title,
            score: 0, // placeholder; items useMemo applies current semanticWeight
            sharedTerms: graph?.sharedTerms,
            graphScoreNorm,
            semanticScoreNorm,
          });
        }
        setRawItems(combined);
      }
    } catch (e) {
      console.error("[RelatedNotesPanel]", e);
      setRawItems([]);
      setError("載入失敗，請重試");
    } finally {
      setLoading(false);
    }
  }, [effectiveNoteId, activeTab, topK]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Hybrid score re-computation (slider moves, no re-fetch) ───────────────
  const items = useMemo(() => {
    if (activeTab !== "hybrid") return rawItems;
    return rawItems.map((item) => ({
      ...item,
      score:
        semanticWeight * (item.semanticScoreNorm ?? 0) +
        (1 - semanticWeight) * (item.graphScoreNorm ?? 0),
    }));
  }, [rawItems, activeTab, semanticWeight]);

  // ── Sort + Filter ──────────────────────────────────────────────────────────
  const sorted = useMemo(
    () =>
      [...items].sort((a, b) =>
        sortBy === "score_asc" ? a.score - b.score : b.score - a.score
      ),
    [items, sortBy]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (r) => r.noteId.includes(q) || r.title.toLowerCase().includes(q)
    );
  }, [sorted, search]);

  // Auto-scroll to active item
  useEffect(() => {
    if (activeIndex >= 0) {
      itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  // ── Keyboard navigation ────────────────────────────────────────────────────
  // Esc precedence: search non-empty → clear; otherwise close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          if (activeIndex >= 0 && activeIndex < filtered.length) {
            window.location.hash = `#/graph?noteId=${filtered[activeIndex].noteId}`;
            onClose();
          }
          break;
        case "Escape":
          if (search) {
            setSearch("");
            setActiveIndex(-1);
          } else {
            onClose();
          }
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtered, activeIndex, search, onClose]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleNoteClick = useCallback(
    (relNoteId: string) => {
      window.location.hash = `#/graph?noteId=${relNoteId}`;
      onClose();
    },
    [onClose]
  );

  const handleCopy = async (r: PanelNote) => {
    const text = formatCopyText(activeTab, r);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("複製此文字：", text);
    }
  };

  const handlePin = (relNoteId: string) => {
    setPinnedNoteId((prev) => (prev === relNoteId ? null : relNoteId));
  };

  const switchTab = (tab: ActiveTab) => {
    if (tab === activeTab) return;
    setRawItems([]);
    setSearch("");
    setPinnedNoteId(null);
    setActiveTab(tab);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    /* Backdrop — container.firstChild in tests */
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <h4 className="text-base font-bold text-gray-900 dark:text-white flex-1 truncate">
            🧩 相關筆記
          </h4>

          {/* Pin indicator */}
          {pinnedNoteId && (
            <span
              data-testid="pin-indicator"
              className="flex items-center gap-1 text-xs text-amber-500 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 px-2 py-0.5 rounded-full truncate max-w-[120px]"
            >
              📌 #{pinnedNoteId}
              <button
                onClick={() => setPinnedNoteId(null)}
                className="ml-0.5 text-gray-400 hover:text-red-400 shrink-0 leading-none"
                title="取消錨點"
              >
                ×
              </button>
            </span>
          )}

          {/* Refresh */}
          <button
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-40 transition-colors"
            title="重新整理"
            aria-label="重新整理"
          >
            🔄
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-lg leading-none"
            aria-label="關閉"
          >
            ×
          </button>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────── */}
        <Tabs<ActiveTab>
          value={activeTab}
          onChange={switchTab}
          tabs={[
            { value: "graph", label: "圖譜" },
            { value: "semantic", label: "語意" },
            { value: "hybrid", label: "混合" },
          ]}
          className="px-5 shrink-0"
        />

        {/* ── Subheader: search + topK + sort ────────────────────── */}
        <div data-testid="control-bar" className="sticky top-0 z-10 flex items-center gap-2 px-5 py-2.5 bg-gray-50/80 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋筆記… (↑↓ Enter)"
            aria-label="搜尋"
            className="flex-1 text-xs py-1.5"
          />
          <select
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            aria-label="顯示筆數"
            className="text-xs px-1.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
          >
            <option value={3}>Top 3</option>
            <option value={5}>Top 5</option>
            <option value={10}>Top 10</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOrder)}
            aria-label="排序"
            className="text-xs px-1.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
          >
            <option value="score_desc">高→低</option>
            <option value="score_asc">低→高</option>
          </select>
        </div>

        {/* ── Hybrid weight slider ────────────────────────────────── */}
        {activeTab === "hybrid" && (
          <div className="flex items-center gap-2 px-5 py-2 bg-gray-50/80 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <span className="text-[10px] font-medium text-gray-500 shrink-0">圖譜</span>
            <Slider
              min={0}
              max={1}
              step={0.1}
              value={semanticWeight}
              onChange={(e) => setSemanticWeight(Number(e.target.value))}
              aria-label="語意權重"
              className="flex-1"
            />
            <span className="text-[10px] font-medium text-gray-500 shrink-0">語意</span>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 w-6 text-right tabular-nums">
              {semanticWeight.toFixed(1)}
            </span>
          </div>
        )}

        {/* ── Body ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          {error ? (
            <div className="text-center py-10 space-y-3">
              <p className="text-3xl">⚠️</p>
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={load}
                data-testid="error-retry"
              >
                🔄 重試
              </Button>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-sm text-gray-400 animate-pulse">載入中…</span>
            </div>
          ) : filtered.length === 0 && search ? (
            <div className="text-center py-10">
              <p className="text-sm text-gray-400 dark:text-gray-500">
                找不到符合「{search}」的筆記
              </p>
            </div>
          ) : rawItems.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <p className="text-3xl">🕸️</p>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">尚無相關筆記</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
                {activeTab === "graph"
                  ? "Worker 處理完三元組後即可顯示"
                  : activeTab === "hybrid"
                  ? "需要至少 1 筆圖譜或語意結果"
                  : "需要 embedding 向量或更多筆記"}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={load}
                data-testid="empty-cta"
              >
                🔄 重新整理
              </Button>
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((r, i) => (
                <RelatedNoteCard
                  key={r.noteId}
                  ref={(el) => { itemRefs.current[i] = el; }}
                  item={r}
                  tab={activeTab}
                  isActive={i === activeIndex}
                  searchQuery={search}
                  isPinned={pinnedNoteId === r.noteId}
                  onMouseEnter={() => setActiveIndex(i)}
                  onNavigate={handleNoteClick}
                  onCopy={handleCopy}
                  onPin={handlePin}
                />
              ))}
            </ul>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 shrink-0">
          <Button variant="primary" size="sm" onClick={onClose} className="w-full justify-center">
            關閉
          </Button>
        </div>
      </div>
    </div>
  );
}
