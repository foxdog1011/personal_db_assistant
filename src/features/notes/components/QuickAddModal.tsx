import React, { useState } from "react";

interface QuickAddModalProps {
  onAdd: (content: string, tags: string, type?: string) => Promise<void>;
  onClose: () => void;
}

const QuickAddModal: React.FC<QuickAddModalProps> = ({ onAdd, onClose }) => {
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");

  const handleAdd = async () => {
    if (!content.trim()) return;
    await onAdd(content, tags);
    setContent("");
    setTags("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-[90%] max-w-md p-6 space-y-4 relative">
        <button
          className="absolute top-3 right-3 text-gray-400 hover:text-red-500 text-xl"
          onClick={onClose}
        >
          ✕
        </button>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
          📝 快速新增筆記
        </h2>

        <textarea
          className="w-full border rounded-lg p-3 text-sm dark:bg-gray-700 dark:text-gray-100"
          placeholder="輸入筆記內容..."
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        <input
          className="w-full border rounded-lg p-3 text-sm dark:bg-gray-700 dark:text-gray-100"
          placeholder="標籤（用逗號分隔）"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />

        <div className="flex justify-end">
          <button
            onClick={handleAdd}
            className="btn btn-success text-sm"
          >
            💾 儲存
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickAddModal;
