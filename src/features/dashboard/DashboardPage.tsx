import { useNotes } from "@/hooks/useNotes";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import type { Note } from "@/types/Note";
import { Modal } from "@/features/common/ui/Modal";
import { Input } from "@/features/common/ui/Input";
import { Card, CardBody } from "@/features/common/ui/Card";
import { Button } from "@/features/common/ui/Button";

/* ---------------------------
   🍏 KeepInMind Dashboard CL3
--------------------------- */
export default function DashboardPage() {
  const { notes, searchNotes } = useNotes();
  const [tags, setTags] = useState<string[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  useEffect(() => {
    const allTags = notes.flatMap((n) =>
      n.tags ? n.tags.split(",").map((t) => t.trim()) : []
    );
    setTags(allTags);
  }, [notes]);

  const latestDate = notes[0]?.created_at?.split(" ")[0] ?? "-";

  return (
    <div className="min-h-screen px-8 py-14">
      {/* 🍏 Hero 區域 */}
      <section className="max-w-4xl mx-auto text-center space-y-6 mb-20">
        <h1 className="text-5xl font-semibold tracking-tight title-gradient">
          KeepInMind
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400">
          Keep your thoughts. Grow your understanding.
        </p>
      </section>

      {/* 🔍 搜尋框 */}
      <div className="max-w-2xl mx-auto mb-20">
        <div className="flex gap-2 search-bar items-center">
          <Input
            prefixIcon={<span className="text-lg">🔍</span>}
            placeholder="Search your notes..."
            onKeyDown={(e) => e.key === "Enter" && searchNotes()}
            className="flex-1"
          />
          <Button variant="primary" size="sm" onClick={() => searchNotes()}>
            Search
          </Button>
        </div>
      </div>

      {/* 📊 統計卡 */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 mb-16">
        <StatCard icon="🧾" title="筆記數" value={notes.length.toString()} />
        <StatCard icon="🏷" title="標籤數" value={tags.length.toString()} />
        <StatCard icon="📅" title="最新更新" value={latestDate} />
      </div>

      {/* 🗂 筆記牆 */}
      <section className="relative max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 p-4">
        {notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onClick={() => setSelectedNote(note)}
          />
        ))}
      </section>

      {/* Note detail modal */}
      <NoteModal
        note={selectedNote}
        onClose={() => setSelectedNote(null)}
        onRefresh={searchNotes}
      />

      <footer className="footer-pulse">
        Designed with 🍎 minimalism in mind.
      </footer>
    </div>
  );
}

/* --------------------------- */
function StatCard({
  icon,
  title,
  value,
}: {
  icon: string;
  title: string;
  value: string;
}) {
  return (
    <Card className="text-center hover:-translate-y-0.5 cursor-default">
      <CardBody className="py-8">
        <div className="text-4xl mb-2">{icon}</div>
        <h2 className="text-gray-500 dark:text-gray-400 text-base">{title}</h2>
        <p className="text-3xl font-semibold text-indigo-600 dark:text-indigo-400 mt-1">
          {value}
        </p>
      </CardBody>
    </Card>
  );
}

/* --------------------------- */
function NoteCard({ note, onClick }: { note: Note; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="glass-card p-6 h-60 cursor-pointer hover:-translate-y-1 transition-all flex flex-col justify-between"
    >
      <div>
        <h3 className="text-gray-800 dark:text-gray-100 font-semibold text-lg mb-2 truncate">
          {note.tags || "未分類"}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-4">
          {note.summary || note.content || "（空白筆記）"}
        </p>
      </div>
      <div className="flex justify-between items-center text-xs text-gray-400 mt-3">
        <span>{note.created_at}</span>
        {note.insight && (
          <span className="text-emerald-500/80 text-[11px] italic">
            💡 有共創見解
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------------------------
   💬 Modal with design-system Modal wrapper
--------------------------- */
function NoteModal({
  note,
  onClose,
  onRefresh,
}: {
  note: Note | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [content, setContent] = useState(note?.content || "");
  const [tags, setTags] = useState(note?.tags || "");
  const [summary, setSummary] = useState(note?.summary || "");
  const [insight, setInsight] = useState(note?.insight || "");
  const [isLoading, setIsLoading] = useState(false);

  // Sync internal state when note changes
  useEffect(() => {
    if (note) {
      setContent(note.content || "");
      setTags(note.tags || "");
      setSummary(note.summary || "");
      setInsight(note.insight || "");
    }
  }, [note]);

  const handleSave = async () => {
    if (!note) return;
    try {
      await window.electronAPI.updateNote({
        id: note.id,
        content,
        tags,
        insight,
      });
      toast.success("✅ 已更新筆記");
      onRefresh();
      onClose();
    } catch {
      toast.error("❌ 更新失敗");
    }
  };

  const handleInsight = async () => {
    if (!note) return;
    setIsLoading(true);
    toast.loading("🧠 正在生成見解...", { id: "insight" });
    try {
      const res = await window.electronAPI.generateInsight({
        id: note.id,
        content,
        summary,
      });
      if (res?.success && res?.insight) {
        setInsight(res.insight);
        toast.success("✨ AI 已生成共創見解", { id: "insight" });
      } else {
        toast.error("⚠️ 無法生成見解", { id: "insight" });
      }
    } catch {
      toast.error("❌ 發生錯誤", { id: "insight" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      open={note !== null}
      onClose={onClose}
      title={tags || note?.tags || "未分類"}
      maxWidth="max-w-3xl"
    >
      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-400">{note?.created_at}</p>

        <textarea
          className="glass-input w-full min-h-[120px] p-4"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="輸入筆記內容..."
        />
        <Input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="用逗號分隔多個標籤"
        />

        {/* AI 摘要 */}
        <div className="glass-section p-5">
          <h3 className="font-medium mb-2">✨ AI 摘要</h3>
          <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
            {summary || "尚未產生摘要"}
          </p>
        </div>

        {/* 個人見解 */}
        <div className="glass-section p-5">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">💡 個人見解 / 共創</h3>
            <button
              onClick={handleInsight}
              disabled={isLoading}
              className="text-sm text-indigo-500 hover:text-indigo-600 disabled:opacity-50"
            >
              ✨ 生成見解
            </button>
          </div>
          {isLoading ? (
            <div className="animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl h-24" />
          ) : (
            <textarea
              className="glass-input w-full min-h-[100px] p-4"
              value={insight}
              onChange={(e) => setInsight(e.target.value)}
              placeholder="輸入心得或讓 AI 幫你生成 ✨"
            />
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="primary" onClick={handleSave}>
            💾 儲存變更
          </Button>
        </div>
      </div>
    </Modal>
  );
}
