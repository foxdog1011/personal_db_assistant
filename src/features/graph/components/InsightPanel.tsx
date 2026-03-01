// src/features/graph/components/InsightPanel.tsx
import React from "react";
import type { Note } from "../hooks/useKnowledgeGraph";

const InsightPanel: React.FC<{ note: Note | null }> = ({ note }) => {
  if (!note)
    return (
      <div className="w-[30%] p-6 bg-gray-900/60 border-l border-gray-700 text-gray-400">
        選擇節點以查看筆記內容。
      </div>
    );

  let insight: any = {};
  try {
    insight = note.insight ? JSON.parse(note.insight) : {};
  } catch {}

  return (
    <div className="w-[30%] p-6 bg-gray-900/70 border-l border-gray-700 overflow-y-auto text-gray-200">
      <h2 className="text-xl font-bold text-indigo-400 mb-3">
        🧠 {note.tags || "無標籤筆記"}
      </h2>

      <p className="text-sm text-gray-300 leading-relaxed mb-4 whitespace-pre-wrap">
        {note.content}
      </p>

      {note.summary && (
        <div className="bg-gray-800/70 p-3 rounded-lg text-sm text-gray-400 mb-4 border border-indigo-500/20">
          <strong>AI 摘要：</strong> {note.summary}
        </div>
      )}

      {insight.connections && (
        <div>
          <h3 className="text-indigo-300 font-semibold mb-2">🔗 關聯節點</h3>
          <ul className="list-disc list-inside text-sm text-gray-400">
            {insight.connections.map((conn: string) => (
              <li key={conn}>{conn}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default InsightPanel;
