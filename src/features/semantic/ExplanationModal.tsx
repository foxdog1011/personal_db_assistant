import React, { useEffect, useState } from "react";
import type { SimilarNote } from "@/types/semantic";

export function ExplanationModal({
  note,
  onClose,
}: {
  note: SimilarNote;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    async function fetchReason() {
      const res = await window.electronAPI.aiQuery({
        prompt: `請簡要說明為什麼以下兩段文字在語意上相似：
1️⃣ ${note.content}
2️⃣ 使用者當前筆記內容
請用一句中文摘要說明。`,
      });
      setReason(res);
    }
    fetchReason();
  }, [note]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
        <h4 className="text-lg font-semibold">為什麼相關？</h4>
        <p className="text-gray-700 whitespace-pre-line">
          {reason || "AI 分析中..."}
        </p>
        <button
          onClick={onClose}
          className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
        >
          關閉
        </button>
      </div>
    </div>
  );
}
