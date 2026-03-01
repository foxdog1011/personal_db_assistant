import React from "react";

export function TagList({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag: string, i: number) => (
        <span
          key={i}
          className="px-3 py-1 text-sm bg-indigo-50 text-indigo-600 rounded-full cursor-pointer hover:bg-indigo-100"
          onClick={() => window.electronAPI.searchNote({ query: tag })}
        >
          #{tag}
        </span>
      ))}
    </div>
  );
}
