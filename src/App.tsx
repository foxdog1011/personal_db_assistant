import React, { useState, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import DashboardPage from "@/features/dashboard/DashboardPage";
import GraphPage from "@/features/graph/pages/GraphPage";
import GraphEvolutionPage from "@/features/graph/GraphEvolutionPage";
import QuickAddPage from "@/features/notes/pages/QuickAddPage";
import NoteList from "@/features/notes/components/NoteList";
import NoteInput from "@/features/notes/components/NoteInput";
import { Note } from "@/types/Note";
import { electronAPI } from "@/services/electronAPI";
import DiagnosticsPanel from "@/features/diagnostics/DiagnosticsPanel";
import { ThemeToggle } from "@/features/common/ui/ThemeToggle";
import { Input } from "@/features/common/ui/Input";
import { Button } from "@/features/common/ui/Button";
import "./index.css";

// ── Nav item ──────────────────────────────────────────────────────────────────
function NavBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        active
          ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
          : "text-gray-600 dark:text-gray-300 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // ── State ────────────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentNoteId, setCurrentNoteId] = useState<number | undefined>();
  const [query, setQuery] = useState("");
  const [orderBy, setOrderBy] = useState("date");

  // ── CRUD ─────────────────────────────────────────────────────────────────────
  const searchNotes = async (customQuery?: string) => {
    try {
      const results = await electronAPI.searchNote({
        query: customQuery ?? query,
        orderBy,
      });
      setNotes(results);
      if (Array.isArray(results) && results.length > 0) {
        setCurrentNoteId(results[0].id);
      }
    } catch (err) {
      console.error("[App] searchNotes:error", err);
    }
  };

  const handleAdd = async (content: string, tags: string, type = "text") => {
    try {
      const created = await electronAPI.addNote({ content, tags, type });
      if (created?.id) setCurrentNoteId(created.id);
      await searchNotes();
    } catch (err) {
      console.error("[App] handleAdd:error", err);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await electronAPI.deleteNote(id);
      await searchNotes();
    } catch (err) {
      console.error("[App] handleDelete:error", err);
    }
  };

  const handleUpdate = async (id: number, content: string, tags: string) => {
    try {
      await electronAPI.updateNote({ id, content, tags });
      await searchNotes();
    } catch (err) {
      console.error("[App] handleUpdate:error", err);
    }
  };

  const handleTogglePin = async (id: number) => {
    try {
      await electronAPI.togglePin(id);
      await searchNotes();
    } catch (err) {
      console.error("[App] handleTogglePin:error", err);
    }
  };

  const handleUpdateColor = async (id: number, color: string) => {
    try {
      await electronAPI.updateColor({ id, color });
      await searchNotes();
    } catch (err) {
      console.error("[App] handleUpdateColor:error", err);
    }
  };

  const handleTagClick = (tag: string) => {
    setQuery(tag);
    searchNotes(tag);
  };

  useEffect(() => {
    searchNotes();
  }, [orderBy]);

  // ── Route flags ───────────────────────────────────────────────────────────────
  const isGraphPage =
    location.pathname === "/graph" || location.pathname === "/graph-evolution";
  const path = location.pathname;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-700">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 backdrop-blur bg-white/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-3 flex justify-between items-center">
          {/* Logo */}
          <button
            onClick={() => navigate("/")}
            className="text-xl font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            🧠 KeepInMind
          </button>

          <div className="flex items-center gap-1.5">
            {!isGraphPage ? (
              <nav className="flex gap-1">
                <NavBtn
                  label="🏠 主控台"
                  active={path === "/"}
                  onClick={() => navigate("/")}
                />
                <NavBtn
                  label="📝 筆記"
                  active={path === "/notes"}
                  onClick={() => navigate("/notes")}
                />
                <NavBtn
                  label="🧩 知識圖譜"
                  active={path === "/graph"}
                  onClick={() => navigate("/graph")}
                />
              </nav>
            ) : (
              <nav className="flex gap-1">
                {location.pathname === "/graph" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/graph-evolution")}
                    className="border-purple-400/60 text-purple-600 dark:text-purple-400"
                  >
                    🪄 查看演化
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/graph")}
                  >
                    ← 返回知識圖
                  </Button>
                )}
              </nav>
            )}
            <ThemeToggle />
            <DiagnosticsPanel />
          </div>
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto p-6">
        <Routes>
          {/* 🏠 主控台 */}
          <Route path="/" element={<DashboardPage />} />

          {/* 📝 筆記頁面 */}
          <Route
            path="/notes"
            element={
              <div className="space-y-6">
                {/* 🔍 搜尋列 */}
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-4">
                  <Input
                    prefixIcon={<span>🔎</span>}
                    placeholder="搜尋筆記、標籤或內容..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchNotes()}
                    className="flex-1"
                  />

                  <select
                    className="text-sm rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-indigo-400 transition"
                    value={orderBy}
                    onChange={(e) => setOrderBy(e.target.value)}
                  >
                    <option value="date">📅 依建立日期</option>
                    <option value="content">🧾 依內容排序</option>
                  </select>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => searchNotes()}
                  >
                    🔍 搜尋
                  </Button>
                </div>

                {/* ✏️ 筆記輸入區 */}
                <NoteInput
                  noteId={currentNoteId}
                  onAdd={handleAdd}
                  onRefresh={searchNotes}
                />

                {/* 📋 筆記列表 */}
                <NoteList
                  notes={notes}
                  onDelete={handleDelete}
                  onUpdate={handleUpdate}
                  onTogglePin={handleTogglePin}
                  onUpdateColor={handleUpdateColor}
                  onTagClick={handleTagClick}
                  onRefresh={searchNotes}
                />
              </div>
            }
          />

          {/* 🧩 知識圖譜 */}
          <Route path="/graph" element={<GraphPage />} />

          {/* 🪄 知識演化視覺化 */}
          <Route path="/graph-evolution" element={<GraphEvolutionPage />} />

          {/* ⚡ Quick Add */}
          <Route path="/quick-add" element={<QuickAddPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
