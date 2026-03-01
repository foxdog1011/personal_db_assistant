import React, { useEffect, useState } from "react";
import NoteInput from "@/features/notes/components/NoteInput";
import NoteList from "@/features/notes/components/NoteList";
import type { Note } from "@/types/Note";
import { electronAPI } from "@/services/electronAPI";
import { Search, RefreshCw } from "lucide-react";

const NoteBoard: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ 初始載入筆記
  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async (query: string = "") => {
    setLoading(true);
    try {
      const result = await electronAPI.searchNote({
        query,
        orderBy: "created_at DESC",
      });
      setNotes(result || []);
    } catch (e) {
      console.error("[UI] fetchNotes:error", e);
    } finally {
      setLoading(false);
    }
  };

  // ✅ 新增筆記
  const handleAddNote = async (content: string, tags: string, type?: string) => {
    try {
      await electronAPI.addNote({ content, tags, type });
      await fetchNotes();
    } catch (e) {
      console.error("[UI] addNote:error", e);
    }
  };

  // ✅ 刪除筆記
  const handleDelete = async (id: number) => {
    try {
      await electronAPI.deleteNote(id);
      await fetchNotes();
    } catch (e) {
      console.error("[UI] deleteNote:error", e);
    }
  };

  // ✅ 更新筆記
  const handleUpdate = async (id: number, content: string, tags: string) => {
    try {
      await electronAPI.updateNote({ id, content, tags });
      await fetchNotes();
    } catch (e) {
      console.error("[UI] updateNote:error", e);
    }
  };

  // ✅ 釘選筆記
  const handleTogglePin = async (id: number) => {
    try {
      await electronAPI.togglePin(id);
      await fetchNotes();
    } catch (e) {
      console.error("[UI] togglePin:error", e);
    }
  };

  // ✅ 更新顏色
  const handleUpdateColor = async (id: number, color: string) => {
    try {
      await electronAPI.updateColor({ id, color });
      await fetchNotes();
    } catch (e) {
      console.error("[UI] updateColor:error", e);
    }
  };

  // ✅ 搜尋筆記
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    fetchNotes(q);
  };

  // ✅ 標籤點擊搜尋
  const handleTagClick = (tag: string) => {
    setSearchQuery(tag);
    fetchNotes(tag);
  };

  return (
    <div className="p-6 min-h-screen bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      {/* 頂部搜尋列 */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative w-full md:w-2/3">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input
            value={searchQuery}
            onChange={handleSearch}
            placeholder="搜尋筆記或標籤..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-300 dark:border-zinc-700 
                       bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-100
                       focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition"
          />
        </div>

        <button
          onClick={() => fetchNotes()}
          className="ml-3 btn btn-secondary flex items-center gap-2 text-sm"
        >
          <RefreshCw size={16} />
          重新整理
        </button>
      </div>

      {/* 筆記輸入區 */}
      <div className="mb-8">
        <NoteInput onAdd={handleAddNote} onRefresh={fetchNotes} />
      </div>

      {/* 筆記列表 */}
      {loading ? (
        <div className="text-center py-10 text-gray-500 dark:text-gray-400 animate-pulse">
          載入中...
        </div>
      ) : (
        <NoteList
          notes={notes}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          onTogglePin={handleTogglePin}
          onUpdateColor={handleUpdateColor}
          onTagClick={handleTagClick}
          onRefresh={fetchNotes}
        />
      )}
    </div>
  );
};

export default NoteBoard;
