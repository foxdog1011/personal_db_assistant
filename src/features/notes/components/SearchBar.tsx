import React from "react";

interface SearchBarProps {
  query: string;
  setQuery: (v: string) => void;
  orderBy: string;
  setOrderBy: (v: string) => void;
  onSearch: (customQuery?: string) => Promise<void>;
}

const SearchBar: React.FC<SearchBarProps> = ({
  query,
  setQuery,
  orderBy,
  setOrderBy,
  onSearch,
}) => {
  return (
    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow p-4">
      <input
        type="text"
        placeholder="🔍 搜尋筆記、標籤或內容..."
        className="flex-1 px-4 py-2 rounded-lg text-gray-800 dark:text-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 outline-none focus:ring-2 focus:ring-indigo-500"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSearch()}
      />

      <select
        className="border rounded-lg px-3 py-2 text-gray-800 dark:text-gray-200 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-indigo-500"
        value={orderBy}
        onChange={(e) => setOrderBy(e.target.value)}
      >
        <option value="date">🗓 依建立時間</option>
        <option value="content">📄 依內容排序</option>
      </select>

      <button
        className="btn btn-primary"
        onClick={() => onSearch()}
        >
        搜尋
      </button>
    </div>
  );
};

export default SearchBar;
