import React, { useState, useEffect } from "react";
import type { Note } from "@/types/Note";
import type { AiJob } from "@/types/electron-api";
import { electronAPI } from "@/services/electronAPI";
import { ipc } from "@/services/electronIpc";
import { Card, CardBody } from "@/features/common/ui/Card";
import { Button } from "@/features/common/ui/Button";
import { Chip } from "@/features/common/ui/Chip";

interface NoteListProps {
  notes: Note[];
  onDelete: (id: number) => Promise<void>;
  onUpdate: (id: number, content: string, tags: string) => Promise<void>;
  onTogglePin: (id: number) => Promise<void>;
  onUpdateColor: (id: number, color: string) => Promise<void>;
  onTagClick: (tag: string) => void;
  onRefresh: () => Promise<void>;
}

/** Per-note AI job status badges (auto-refresh while jobs are in-flight) */
const AiJobBadges: React.FC<{ noteId: number }> = ({ noteId: noteIdNum }) => {
  const noteId = noteIdNum.toString();
  const [jobs, setJobs] = useState<AiJob[]>([]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetch = () => {
      ipc.getNoteAiJobs(noteId).then((res) => {
        if (cancelled) return;
        const list = res || [];
        setJobs(list);
        // Stop polling once all jobs are terminal
        const allDone = list.length > 0 && list.every((j) => j.status === "done" || j.status === "error");
        if (allDone && timer) {
          clearInterval(timer);
          timer = null;
        }
      }).catch(() => {});
    };

    fetch();
    timer = setInterval(fetch, 5_000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [noteId]);

  if (jobs.length === 0) return null;

  const statusConfig: Record<string, { bg: string; label: string }> = {
    pending: { bg: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300", label: "queued" },
    running: { bg: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", label: "running" },
    done: { bg: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300", label: "done" },
    error: { bg: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300", label: "error" },
  };

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {jobs.map((j) => {
        const cfg = statusConfig[j.status] || statusConfig.pending;
        return (
          <span
            key={j.id}
            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cfg.bg}`}
            title={j.last_error ? `${j.job_type}: ${j.last_error}` : j.job_type}
          >
            {j.job_type} {cfg.label}
          </span>
        );
      })}
    </div>
  );
};

const NoteList: React.FC<NoteListProps> = ({
  notes,
  onDelete,
  onUpdate,
  onTogglePin,
  onUpdateColor,
  onTagClick,
  onRefresh,
}) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState("");
  const [generatingId, setGeneratingId] = useState<number | null>(null);

  const handleEdit = (note: Note) => {
    setEditingId(note.id);
    setEditContent(note.content);
    setEditTags(note.tags || "");
  };

  const handleSave = async (id: number) => {
    await onUpdate(id, editContent, editTags);
    setEditingId(null);
  };

  const handleSummarize = async (id: number) => {
    try {
      const note = notes.find((n) => n.id === id);
      if (!note) {
        console.error("[UI] generate-summary:error 無法找到筆記");
        return;
      }

      if (!note.id || note.id <= 0) {
        alert("⚠️ 請先儲存筆記，再產生摘要！");
        return;
      }

      if (!note.content?.trim()) {
        alert("這筆筆記沒有內容，無法生成摘要！");
        return;
      }

      setGeneratingId(id);
      console.log("[UI] generate-summary:start", { id, content: note.content.slice(0, 50) });

      const res = await electronAPI.generateSummary({ id, content: note.content });

      if (!res?.success) {
        console.error("[UI] generate-summary:error", res?.error || res);
        alert(`❌ 生成摘要失敗：${res?.error || "未知錯誤"}`);
      } else {
        console.log("[UI] generate-summary:done", res.summary);
        await onRefresh();
      }
    } catch (e) {
      console.error("[UI] generate-summary:exception", e);
      alert("⚠️ 生成摘要時發生錯誤");
    } finally {
      setGeneratingId(null);
    }
  };

  const isValidUrl = (text: string) => /^https?:\/\/[^\s]+$/.test(text);

  return (
    <div className="space-y-4">
      {notes.length === 0 ? (
        <div className="text-center text-gray-400 dark:text-gray-500 py-16">
          ✨ 尚無筆記，開始新增一則吧！
        </div>
      ) : (
        notes.map((note) => {
          const isUrlNote = note.type === "url" || isValidUrl(note.content);

          // ✅ 嘗試解析 insight JSON
          let insight: any = null;
          try {
            insight = note.insight ? JSON.parse(note.insight) : null;
          } catch {
            insight = null;
          }

          return (
            <Card
              key={note.id}
              className="group relative overflow-visible"
              style={{ borderLeft: `5px solid ${note.color || "#6366f1"}` }}
            >
              <CardBody className="p-5">
                {/* ── 標題行 ──────────────────────────────── */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Pin toggle */}
                    {note.pinned ? (
                      <button
                        onClick={() => onTogglePin(note.id)}
                        className="text-yellow-400 text-lg leading-none"
                        title="取消釘選"
                      >
                        📌
                      </button>
                    ) : (
                      <button
                        onClick={() => onTogglePin(note.id)}
                        className="opacity-0 group-hover:opacity-70 transition text-gray-400 hover:text-yellow-400 text-lg leading-none"
                        title="釘選"
                      >
                        📍
                      </button>
                    )}

                    <h2 className="font-semibold text-gray-800 dark:text-gray-100 leading-tight">
                      筆記 #{note.id}
                    </h2>

                    {/* Graph link */}
                    <a
                      href={`#/graph?noteId=${note.id}`}
                      title="在知識圖譜中查看此筆記"
                      className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 transition"
                    >
                      🧩
                    </a>

                    <AiJobBadges noteId={note.id} />
                  </div>

                  {/* Color selector */}
                  <select
                    value={note.color || "#6366f1"}
                    onChange={(e) => onUpdateColor(note.id, e.target.value)}
                    className="text-xs rounded-md border border-gray-200 dark:border-gray-600 bg-transparent text-gray-600 dark:text-gray-300 cursor-pointer focus:ring-1 focus:ring-indigo-400 px-1"
                    title="變更色標"
                  >
                    <option value="#6366f1">Indigo</option>
                    <option value="#10b981">Green</option>
                    <option value="#f59e0b">Amber</option>
                    <option value="#ef4444">Red</option>
                    <option value="#8b5cf6">Purple</option>
                  </select>
                </div>

                {/* ── Content area ─────────────────────────── */}
                {editingId === note.id ? (
                  <div className="space-y-3">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-3 outline-none focus:ring-2 focus:ring-indigo-400 resize-none text-gray-800 dark:text-gray-100"
                      rows={4}
                    />
                    <input
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      placeholder="輸入標籤（以逗號分隔）"
                      className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-2.5 outline-none focus:ring-2 focus:ring-indigo-400 text-gray-800 dark:text-gray-100"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="primary" onClick={() => handleSave(note.id)}>
                        💾 儲存
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        取消
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* URL card */}
                    {isUrlNote ? (
                      <a
                        href={note.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition bg-gray-50 dark:bg-gray-700/60"
                      >
                        <div className="p-3">
                          <span className="text-indigo-500 text-sm font-medium">🌐 網址筆記</span>
                          <p className="text-indigo-600 dark:text-indigo-400 text-sm break-all mt-0.5">
                            {note.content}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">🔗 點擊開啟連結</p>
                        </div>
                      </a>
                    ) : (
                      <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed text-sm">
                        {note.content}
                      </p>
                    )}

                    {/* AI Insight */}
                    {insight && (
                      <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-3 text-sm space-y-2">
                        <div>
                          <strong className="text-indigo-500">🧩 Insight：</strong>
                          <span className="text-gray-700 dark:text-gray-300">{insight.summary}</span>
                        </div>
                        {insight.expansion?.length > 0 && (
                          <div>
                            <strong className="text-indigo-500">🌱 延伸想法：</strong>
                            <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mt-0.5">
                              {insight.expansion.map((idea: string, i: number) => (
                                <li key={i}>{idea}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {insight.connections?.length > 0 && (
                          <div>
                            <strong className="text-indigo-500">🔗 關聯：</strong>
                            <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mt-0.5">
                              {insight.connections.map((c: string, i: number) => (
                                <li key={i}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* AI 摘要 */}
                    {note.summary && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 border-t border-gray-100 dark:border-gray-700 pt-2 leading-relaxed">
                        🧠 <span className="font-medium text-gray-500 dark:text-gray-400">AI 摘要：</span>
                        {note.summary}
                      </p>
                    )}

                    {/* 標籤 */}
                    {note.tags && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {note.tags
                          .split(",")
                          .filter(Boolean)
                          .map((tag: string) => (
                            <Chip
                              key={tag}
                              onClick={() => onTagClick(tag)}
                              className="cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-800/50 transition"
                            >
                              #{tag.trim()}
                            </Chip>
                          ))}
                      </div>
                    )}
                  </>
                )}
              </CardBody>

              {/* ── Action toolbar ───────────────────────── */}
              <div className="absolute right-4 bottom-3 opacity-0 group-hover:opacity-100 flex items-center gap-1.5 transition-opacity duration-150">
                {note.id > 0 && (
                  <button
                    className="text-xs text-indigo-400 hover:text-indigo-600 px-2 py-1 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition"
                    onClick={() => handleSummarize(note.id)}
                    disabled={generatingId === note.id}
                    title="產生摘要"
                  >
                    {generatingId === note.id ? "⏳" : "✨"} 摘要
                  </button>
                )}
                <button
                  onClick={() => handleEdit(note)}
                  className="text-xs text-gray-400 hover:text-indigo-500 px-2 py-1 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition"
                  title="編輯"
                >
                  ✏️
                </button>
                <button
                  onClick={() => onDelete(note.id)}
                  className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 transition"
                  title="刪除"
                >
                  🗑️
                </button>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
};

export default NoteList;
