import NoteCard from "./NoteCard";
import { Note } from "@/types/Note";

export default function TagSection({ notes }: { notes: Note[] }) {
  // 🏷 按標籤分群
  const grouped = notes.reduce((acc: Record<string, Note[]>, note) => {
    const tags = note.tags ? note.tags.split(",").map((t) => t.trim()) : ["未分類"];
    for (const tag of tags) {
      if (!acc[tag]) acc[tag] = [];
      acc[tag].push(note);
    }
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {Object.keys(grouped).length === 0 ? (
        <p className="text-gray-500 text-sm">目前沒有筆記，開始新增一些吧！</p>
      ) : (
        Object.entries(grouped).map(([tag, tagNotes]) => (
          <section key={tag}>
            <h3 className="text-indigo-400 font-semibold mb-3 text-lg flex items-center gap-1">
              🏷 {tag}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {tagNotes.map((note) => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
