import React from "react";

export type BadgeVariant = "graph" | "semantic" | "hybrid" | "neutral";

const variantStyles: Record<BadgeVariant, string> = {
  graph:
    "bg-emerald-50 text-emerald-700 border-emerald-200 " +
    "dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/60",
  semantic:
    "bg-violet-50 text-violet-700 border-violet-200 " +
    "dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700/60",
  hybrid:
    "bg-indigo-50 text-indigo-700 border-indigo-200 " +
    "dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700/60",
  neutral:
    "bg-gray-100 text-gray-600 border-gray-200 " +
    "dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  label: string;
  variant?: BadgeVariant;
  "data-testid"?: string;
}

export function Badge({
  label,
  variant = "neutral",
  "data-testid": testId,
  className = "",
  ...rest
}: BadgeProps) {
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded-md border ${variantStyles[variant]} ${className}`.trim()}
      {...rest}
    >
      {label}
    </span>
  );
}

export default Badge;
