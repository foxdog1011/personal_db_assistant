import { useState } from "react";

export default function SearchBar({ onSearch }: { onSearch: (query: string) => void }) {
  const [query, setQuery] = useState("");

  return (
    <div className="flex gap-3 items-center bg-gray-900 px-5 py-3 rounded-xl shadow-lg">
      <input
        type="text"
        placeholder="🔍 搜尋筆記、標籤或關鍵字..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSearch(query)}
        className="flex-1 bg-transparent outline-none text-gray-200 placeholder-gray-500 text-sm"
      />
      <button
        onClick={() => onSearch(query)}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium transition"
      >
        搜尋
      </button>
    </div>
  );
}
