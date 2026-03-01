import React, { useState } from "react";

export default function QuickAddPage() {
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const res = await window.electronAPI.quickAddNote({ content: content.trim(), tags: tags.trim() });
      if (res?.success) {
        window.close();
      } else {
        alert("新增筆記失敗");
      }
    } catch (e) {
      alert("儲存時發生錯誤");
    } finally {
      setSaving(false);
    }
  };

  const onCancel = () => window.close();

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-5 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">📝 快速新增筆記</h2>
        <textarea
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 resize-none"
          rows={4}
          placeholder="輸入筆記內容..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSave();
            }
          }}
        />
        <input
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
          placeholder="標籤（用逗號分隔）"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
          >
            取消
          </button>
          <button
            onClick={onSave}
            disabled={saving || !content.trim()}
            className="px-4 py-2 text-sm rounded-lg text-white bg-green-500 hover:bg-green-600 disabled:opacity-60"
          >
            {saving ? "儲存中..." : "💾 儲存"}
          </button>
        </div>
      </div>
    </div>
  );
}

