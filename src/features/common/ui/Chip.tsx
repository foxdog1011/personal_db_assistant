import React from "react";

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

export function Chip({ children, className = "", ...rest }: ChipProps) {
  return (
    <span
      className={
        "inline-flex items-center text-xs px-2 py-0.5 rounded-full " +
        "bg-indigo-50 dark:bg-indigo-900/30 " +
        "text-indigo-700 dark:text-indigo-300 " +
        "border border-indigo-100 dark:border-indigo-800 " +
        className
      }
      {...rest}
    >
      {children}
    </span>
  );
}

export default Chip;
