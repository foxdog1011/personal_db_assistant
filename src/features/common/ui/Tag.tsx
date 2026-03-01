import React from "react";

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: "primary" | "success" | "secondary" | "neutral";
  rounded?: boolean;
}

const colorMap = {
  primary: "bg-indigo-100 text-indigo-700 dark:bg-indigo-700 dark:text-indigo-100",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-700 dark:text-emerald-100",
  secondary: "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100",
  neutral: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
};

export const Tag: React.FC<TagProps> = ({
  color = "secondary",
  rounded = true,
  className = "",
  children,
  ...rest
}) => {
  const shape = rounded ? "rounded-full" : "rounded-md";
  const cls = `inline-flex items-center px-2 py-0.5 text-xs ${shape} ${colorMap[color]} ${className}`.trim();
  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  );
};

export default Tag;

