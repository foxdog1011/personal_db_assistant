import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import type { Note } from "@/types/Note";
import { electronAPI } from "@/services/electronAPI";

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [query, setQuery] = useState("");
  const [orderBy, setOrderBy] = useState("date");
  const [currentNoteId, setCurrentNoteId] = useState<number | undefined>(undefined);

  /** 搜尋筆記 */
  const searchNotes = useCallback(
    async (customQuery?: string): Promise<Note[]> => {
      try {
        const results: Note[] = await electronAPI.searchNote({
          query: customQuery ?? query,
          orderBy,
        });

        if (Array.isArray(results)) {
          setNotes(results);
          if (results.length > 0) {
            setCurrentNoteId(results[0].id);
          }
          return results;
        }

        return [];
      } catch (err) {
        console.error("[useNotes] searchNotes:error", err);
        toast.error("搜尋筆記失敗");
        return [];
      }
    },
    [query, orderBy]
  );

  useEffect(() => {
    searchNotes();
  }, [orderBy]);

  /** CRUD */
  const addNote = async (content: string, tags: string, type = "text") => {
    try {
      const created = await electronAPI.addNote({ content, tags, type });
      if (created?.id) {
        setCurrentNoteId(created.id);
        toast.success("已新增筆記！");
      }
      await searchNotes();
    } catch {
      toast.error("新增失敗");
    }
  };

  const deleteNote = async (id: number) => {
    try {
      await electronAPI.deleteNote(id);
      toast("🗑️ 筆記已刪除");
      await searchNotes();
    } catch (e) {
      toast.error("刪除失敗");
      console.error("[useNotes] deleteNote:error", e);
    }
  };

  const updateNote = async (id: number, content: string, tags: string) => {
    try {
      await electronAPI.updateNote({ id, content, tags });
      toast.success("✏️ 筆記已更新");
      await searchNotes();
    } catch (e) {
      toast.error("更新失敗");
      console.error("[useNotes] updateNote:error", e);
    }
  };

  const togglePin = async (id: number) => {
    try {
      await electronAPI.togglePin(id);
      toast("📌 已切換釘選狀態");
      await searchNotes();
    } catch (e) {
      toast.error("切換失敗");
      console.error("[useNotes] togglePin:error", e);
    }
  };

  const updateColor = async (id: number, color: string) => {
    try {
      await electronAPI.updateColor({ id, color });
      toast("🎨 顏色已更新");
      await searchNotes();
    } catch (e) {
      toast.error("更新顏色失敗");
      console.error("[useNotes] updateColor:error", e);
    }
  };

  /** AI 摘要（依 note.id 操作） */
  const generateSummary = async (id: number) => {
    toast.loading("✨ 生成中...", { id: "summary" });
    try {
      const res = await electronAPI.generateSummary({ id, content: "" });
      if (res?.success) {
        toast.success("AI 摘要已生成！", { id: "summary" });
        await searchNotes();
      } else {
        toast.error(res?.error || "生成失敗", { id: "summary" });
      }
    } catch {
      toast.error("AI 摘要時發生錯誤", { id: "summary" });
    }
  };

  return {
    notes,
    addNote,
    deleteNote,
    searchNotes,
    query,
    setQuery,
    orderBy,
    setOrderBy,
    currentNoteId,
    updateNote,
    togglePin,
    updateColor,
    generateSummary,
  };
}
