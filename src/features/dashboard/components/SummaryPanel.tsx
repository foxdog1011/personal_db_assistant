export default function SummaryPanel({
  summary,
}: {
  summary: { total: number; tags: string[] } | null;
}) {
  if (!summary) return null;

  return (
    <div className="bg-gray-900/80 backdrop-blur-md rounded-xl border border-gray-800 shadow-xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h2 className="text-lg font-semibold text-indigo-400 mb-1">📊 知識總覽</h2>
        <p className="text-gray-300 text-sm">筆記總數：{summary.total}</p>
        <p className="text-gray-400 text-sm">標籤數量：{summary.tags.length}</p>
      </div>

      <div className="flex flex-wrap gap-2 max-w-md justify-end">
        {summary.tags.slice(0, 10).map((tag) => (
          <span
            key={tag}
            className="text-xs bg-gray-800/80 border border-gray-700 px-2 py-1 rounded-md text-indigo-300"
          >
            #{tag.trim()}
          </span>
        ))}
      </div>
    </div>
  );
}
