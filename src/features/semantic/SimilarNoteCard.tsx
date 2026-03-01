import React from "react";
import type { SimilarNote } from "@/types/semantic";

export function SimilarNoteCard({
  note,
  onClick,
}: {
  note: SimilarNote;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="p-4 rounded-xl border border-gray-200 hover:border-indigo-400 cursor-pointer transition"
    >
      <p className="text-gray-800 line-clamp-3 mb-2">{note.content}</p>
      <span className="text-xs text-gray-500">
        相似度：{(note.score * 100).toFixed(1)}%
      </span>
    </div>
  );
}
