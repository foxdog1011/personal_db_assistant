import { Note } from "@/types/Note";

export default function NoteCard({ note }: { note: Note }) {
  const displayDate = note.created_at
    ? new Date(note.created_at).toLocaleString()
    : "未指定時間";

  return (
    <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 hover:bg-gray-800 transition-all shadow-md">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-gray-500">{displayDate}</span>
      </div>
      <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed line-clamp-4">
        {note.content}
      </p>

      {note.summary && (
        <p className="text-xs text-gray-400 mt-2 border-t border-gray-700 pt-2 line-clamp-3">
          摘要：{note.summary}
        </p>
      )}

      {note.tags && (
        <div className="flex flex-wrap gap-1 mt-3">
          {note.tags.split(",").map((t) => (
            <span
              key={t}
              className="text-xs bg-gray-800/90 text-indigo-300 px-2 py-0.5 rounded-md"
            >
              #{t.trim()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
