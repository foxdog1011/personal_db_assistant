import React, { useState } from "react";
import type { Note } from "@/types/Note";
import { ExplanationModal } from "@/features/semantic/ExplanationModal";
import { RelatedNotesPanel } from "./RelatedNotesPanel";
import { Card, CardBody } from "@/features/common/ui/Card";
import { Button } from "@/features/common/ui/Button";
import { Chip } from "@/features/common/ui/Chip";

interface NoteCardProps {
  note: Note;
  onDelete: (id: number) => Promise<void>;
  onUpdate: (id: number, content: string, tags: string) => Promise<void>;
  onTogglePin: (id: number) => Promise<void>;
  onUpdateColor: (id: number, color: string) => Promise<void>;
  onTagClick: (tag: string) => void;
}

const NoteCard: React.FC<NoteCardProps> = ({
  note,
  onDelete,
  onUpdate,
  onTogglePin,
  onUpdateColor,
  onTagClick,
}) => {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(note.content);
  const [editTags, setEditTags] = useState(note.tags || "");
  const [showExplainModal, setShowExplainModal] = useState(false);
  const [showRelatedPanel, setShowRelatedPanel] = useState(false);

  const handleSave = async () => {
    await onUpdate(note.id, editContent, editTags);
    setEditing(false);
  };

  const isUrl = /^https?:\/\/[^\s]+$/.test(note.content);

  return (
    <Card
      className="group relative"
      style={{ borderLeft: `5px solid ${note.color || "#6366f1"}` }}
    >
      <CardBody className="p-5 space-y-3">
        {/* ── 標題列 ──────────────────────────────────────── */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
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
              >
                📍
              </button>
            )}
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">
              筆記 #{note.id}
            </h2>
          </div>

          <select
            value={note.color || "#6366f1"}
            onChange={(e) => onUpdateColor(note.id, e.target.value)}
            className="text-xs rounded-md border border-gray-200 dark:border-gray-600 bg-transparent text-gray-600 dark:text-gray-300 cursor-pointer focus:ring-1 focus:ring-indigo-400 px-1"
          >
            <option value="#6366f1">Indigo</option>
            <option value="#10b981">Green</option>
            <option value="#f59e0b">Amber</option>
            <option value="#ef4444">Red</option>
            <option value="#8b5cf6">Purple</option>
          </select>
        </div>

        {/* ── Edit mode ────────────────────────────────────── */}
        {editing ? (
          <div className="space-y-3">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-3 outline-none focus:ring-2 focus:ring-indigo-400 resize-none min-h-[100px] text-gray-800 dark:text-gray-100"
            />
            <input
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              placeholder="輸入標籤（以逗號分隔）"
              className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-2.5 outline-none focus:ring-2 focus:ring-indigo-400 text-gray-800 dark:text-gray-100"
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="primary" onClick={handleSave}>
                💾 儲存
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                取消
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Content / URL */}
            {isUrl ? (
              <a
                href={note.content}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-indigo-500 dark:text-indigo-400 hover:underline text-sm break-all"
              >
                🔗 {note.content}
              </a>
            ) : (
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap text-sm">
                {note.content}
              </p>
            )}

            {/* AI 摘要 */}
            {note.summary && (
              <p className="text-xs text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-2 leading-relaxed">
                🧠 <span className="font-medium text-gray-500 dark:text-gray-400">AI 摘要：</span>
                {note.summary}
              </p>
            )}

            {/* 標籤 */}
            {note.tags && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {note.tags.split(",").map((tag) => (
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

      {/* ── Action toolbar (hover) ───────────────────────── */}
      <div className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity duration-150">
        <button
          onClick={() => setEditing(true)}
          className="p-1.5 rounded-md text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition text-sm"
          title="編輯"
        >
          ✏️
        </button>
        <button
          onClick={() => setShowExplainModal(true)}
          className="p-1.5 rounded-md text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition text-sm"
          title="語義解釋"
        >
          💡
        </button>
        <button
          onClick={() => setShowRelatedPanel(true)}
          className="p-1.5 rounded-md text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition text-sm"
          title="相關筆記（概念共現）"
        >
          🧩
        </button>
        <button
          onClick={() => onDelete(note.id)}
          className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition text-sm"
          title="刪除"
        >
          🗑️
        </button>
      </div>

      {/* 🧠 Explanation Modal */}
      {showExplainModal && (
        <ExplanationModal
          note={{ id: note.id, content: note.content, score: 0 }}
          onClose={() => setShowExplainModal(false)}
        />
      )}

      {/* 🧩 Related Notes Panel */}
      {showRelatedPanel && (
        <RelatedNotesPanel
          noteId={note.id}
          onClose={() => setShowRelatedPanel(false)}
        />
      )}
    </Card>
  );
};

export default NoteCard;
