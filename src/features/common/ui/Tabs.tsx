import React from "react";

export interface TabItem<T extends string = string> {
  value: T;
  label: React.ReactNode;
}

export interface TabsProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  tabs: TabItem<T>[];
  className?: string;
}

export function Tabs<T extends string = string>({
  value,
  onChange,
  tabs,
  className = "",
}: TabsProps<T>) {
  return (
    <div
      className={`flex border-b border-gray-200 dark:border-gray-700 ${className}`}
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={[
            "flex-1 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
            value === tab.value
              ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300",
          ].join(" ")}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default Tabs;
