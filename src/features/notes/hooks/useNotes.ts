import { useCallback, useEffect, useState } from "react";
import type { Note } from "@/types/Note";
import { electronAPI } from "@/services/electronAPI";

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [query, setQuery] = useState("");
  const [orderBy, setOrderBy] = useState("date");
  const [currentNoteId, setCurrentNoteId] = useState<number | undefined>(
    undefined
  );

  const searchNotes = useCallback(
    async (customQuery?: string) => {
      try {
        const results = await electronAPI.searchNote({
          query: customQuery ?? query,
          orderBy,
        });
        if (Array.isArray(results)) {
          setNotes(results);
          if (results.length > 0) {
            setCurrentNoteId(results[0].id);
          }
        } else {
          console.warn("[UI] searchNotes: 非陣列結果", results);
        }
      } catch (err) {
        console.error("[UI] searchNotes:error", err);
      }
    },
    [orderBy, query]
  );

  useEffect(() => {
    searchNotes();
  }, [searchNotes]);

  const addNote = useCallback(
    async (content: string, tags: string, type: string = "text") => {
      try {
        const created: any = await electronAPI.addNote({ content, tags, type });
        if (created && typeof created.id === "number") {
          setCurrentNoteId(created.id);
        }
        await searchNotes();
        return created; // ✅ 關鍵修正：回傳結果給 NoteInput
      } catch (e) {
        console.error("[UI] addNote:error", e);
      }
    },
    [searchNotes]
  );

  const deleteNote = useCallback(
    async (id: number) => {
      try {
        await electronAPI.deleteNote(id);
        await searchNotes();
      } catch (e) {
        console.error("[UI] deleteNote:error", e);
      }
    },
    [searchNotes]
  );

  const updateNote = useCallback(
    async (id: number, content: string, tags: string) => {
      try {
        await electronAPI.updateNote({ id, content, tags });
        await searchNotes();
      } catch (e) {
        console.error("[UI] updateNote:error", e);
      }
    },
    [searchNotes]
  );

  const togglePin = useCallback(
    async (id: number) => {
      try {
        await electronAPI.togglePin(id);
        await searchNotes();
      } catch (e) {
        console.error("[UI] togglePin:error", e);
      }
    },
    [searchNotes]
  );

  const updateColor = useCallback(
    async (id: number, color: string) => {
      try {
        await electronAPI.updateColor({ id, color });
        await searchNotes();
      } catch (e) {
        console.error("[UI] updateColor:error", e);
      }
    },
    [searchNotes]
  );

  return {
    notes,
    query,
    orderBy,
    currentNoteId,
    setQuery,
    setOrderBy,
    setCurrentNoteId,
    searchNotes,
    addNote,
    deleteNote,
    updateNote,
    togglePin,
    updateColor,
  };
}
