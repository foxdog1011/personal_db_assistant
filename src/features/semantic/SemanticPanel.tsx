import React from "react";
import { useSemanticNotes } from "@/hooks/useSemanticNotes";
import { SimilarNoteCard } from "./SimilarNoteCard";
import { TagList } from "./TagList";
import { ExplanationModal } from "./ExplanationModal";

export function SemanticPanel({ noteId }: { noteId: number }) {
  const {
    relatedNotes,
    tags,
    loading,
    selectedNote,
    setSelectedNote,
  } = useSemanticNotes(noteId);

  if (loading)
    return <p className="text-gray-500 text-sm">AI 語義關聯分析中...</p>;

  return (
    <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-200 space-y-6">
      <h3 className="text-xl font-semibold text-gray-900">AI 語義推薦</h3>

      {relatedNotes.length === 0 ? (
        <p className="text-gray-500 text-sm">尚無相似筆記，試著新增更多內容。</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {relatedNotes.map((note) => (
            <SimilarNoteCard
              key={note.id}
              note={note}
              onClick={() => setSelectedNote(note)}
            />
          ))}
        </div>
      )}

      {tags.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">AI 延伸標籤</h4>
          <TagList tags={tags} />
        </div>
      )}

      {selectedNote && (
        <ExplanationModal
          note={selectedNote}
          onClose={() => setSelectedNote(null)}
        />
      )}
    </div>
  );
}
