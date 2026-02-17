import React, { useState, useEffect, useRef } from "react";
import { ipc } from "@/services/electronIpc";

interface NoteInputProps {
  /** 當新增或更新筆記時觸發 */
  onAdd: (content: string, tags: string, type?: string) => Promise<{ id: number } | void>;
  /** 筆記 ID，用於 AI 摘要或三元組分析 */
  noteId?: number;
  /** 更新父層的筆記列表 */
  onRefresh?: () => void;
}

const NoteInput: React.FC<NoteInputProps> = ({ onAdd, noteId, onRefresh }) => {
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [type, setType] = useState<"text" | "url">("text");
  const [loading, setLoading] = useState(false);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /** 🔍 自動辨識網址，切換輸入模式 */
  useEffect(() => {
    const urlRegex = /^https?:\/\/[^\s]+$/;
    setType(urlRegex.test(content.trim()) ? "url" : "text");
  }, [content]);

  /** 🧠 自動產生簡單標籤建議 */
  useEffect(() => {
    if (type === "text" && content.length > 10) {
      const words = content
        .replace(/[.,!?]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .slice(0, 3);
      setSuggestedTags(words);
    } else {
      setSuggestedTags([]);
    }
  }, [content, type]);

  /** 💾 儲存筆記 + 自動觸發 AI 三元組抽取 */
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    try {
      // 1️⃣ 儲存筆記
      const result = await onAdd(content.trim(), tags.trim(), type);
      const savedId = result && "id" in result ? result.id : noteId;

      // 2️⃣ AI 三元組抽取（僅限文字筆記）
      if (savedId && type === "text") {
        console.log("[AI] Extracting triples for note:", savedId);
        const triplesRes = await ipc.extractTriples(savedId);

        if (triplesRes?.success) {
          console.log(`[AI] ✅ Extracted ${triplesRes.triples.length} triples`);
          await ipc.getKnowledgeGraph();
          alert(`✅ 筆記已儲存並更新知識圖譜！（共 ${triplesRes.triples.length} 條關聯）`);
        } else {
          alert("✅ 筆記已儲存，但未成功抽取關聯。");
        }
      } else {
        alert("✅ 筆記已儲存！");
      }

      // 3️⃣ 重置狀態
      setContent("");
      setTags("");
      setType("text");
      setSuggestedTags([]);
      onRefresh?.();
      inputRef.current?.focus();
    } catch (err) {
      console.error("[NoteInput] handleSubmit:error", err);
      alert("❌ 儲存或 AI 分析時發生錯誤。");
    } finally {
      setLoading(false);
    }
  };

  /** ✨ 生成 AI 摘要 */
  const handleGenerateSummary = async () => {
    if (!noteId) {
      alert("⚠️ 請先儲存筆記再使用 AI 摘要。");
      return;
    }
    setLoading(true);
    try {
      const res: any = await ipc.generateSummary({ id: noteId, content });
      if (res?.success && res?.summary) {
        alert("✅ AI 摘要已生成！");
        onRefresh?.();
      } else {
        alert(`❌ 生成摘要失敗：${res?.error || "未知錯誤"}`);
      }
    } catch (err) {
      console.error("[UI] ai-summary:error", err);
      alert("⚠️ 生成摘要時發生錯誤。");
    } finally {
      setLoading(false);
    }
  };

  const hasNoteId = noteId != null && noteId > 0;
  const showAiButton = hasNoteId || content.trim().length > 0;

  return (
    <form
      onSubmit={handleSubmit}
      className="card border border-gray-200 dark:border-gray-700 overflow-hidden rounded-2xl shadow-sm hover:shadow-md transition-all bg-white dark:bg-gray-800"
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-2 flex flex-wrap justify-between items-center gap-2 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          <span
            className={`px-2 py-1 rounded-md text-xs ${
              type === "url"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100"
                : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            {type === "url" ? "🔗 網址筆記" : "📝 文字筆記"}
          </span>
        </div>

        <span className="text-xs text-gray-400 dark:text-gray-500 italic">
          {type === "text"
            ? "可輸入任意筆記內容（Enter 送出）"
            : "偵測到網址，會自動建立連結卡片"}
        </span>
      </div>

      {/* Content Input */}
      <div className="px-5 py-4">
        <textarea
          ref={inputRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          rows={4}
          placeholder={
            type === "text"
              ? "輸入你的想法、靈感或筆記（按 Enter 快速儲存）"
              : "輸入網址（https://...）"
          }
          className="w-full resize-none bg-transparent text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 outline-none text-sm leading-relaxed"
        />
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/40 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
        {/* 標籤輸入 + 自動建議 */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="輸入標籤（用逗號分隔）"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
          {suggestedTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {suggestedTags.map((tag) => (
                <span
                  key={tag}
                  onClick={() => {
                    const newTags = tags ? `${tags},${tag}` : tag;
                    setTags(newTags);
                  }}
                  className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-600 hover:text-white transition"
                >
                  ＋ {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 按鈕區 */}
        <div className="flex items-center gap-2">
          {showAiButton && (
            <button
              type="button"
              onClick={handleGenerateSummary}
              disabled={loading || !hasNoteId}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                hasNoteId
                  ? "text-white bg-indigo-500 hover:bg-indigo-600"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              } ${loading ? "opacity-60 cursor-not-allowed" : ""}`}
              title={hasNoteId ? "產生 AI 摘要" : "請先儲存筆記再使用 AI 摘要"}
            >
              {loading ? "生成中..." : "✨ AI 摘要"}
            </button>
          )}

          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-green-500 hover:bg-green-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "處理中..." : "💾 儲存"}
          </button>
        </div>
      </div>
    </form>
  );
};

export default NoteInput;
