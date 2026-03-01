import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "success" | "danger" | "neutral";
type Size = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leftIcon?: React.ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition shadow-sm " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1 " +
  "disabled:opacity-60 disabled:cursor-not-allowed disabled:ring-0 disabled:ring-offset-0";

const sizeMap: Record<Size, string> = {
  sm: "text-sm px-3 py-1.5",
  md: "text-sm px-4 py-2",
  lg: "text-base px-5 py-2.5",
};

const variantMap: Record<Variant, string> = {
  primary:
    "bg-indigo-500 hover:bg-indigo-600 text-white",
  secondary:
    "bg-gray-700 hover:bg-gray-800 text-white dark:bg-gray-600 dark:hover:bg-gray-500",
  ghost:
    "bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 shadow-none border border-gray-200 dark:border-gray-700",
  success:
    "bg-emerald-500 hover:bg-emerald-600 text-white",
  danger:
    "bg-red-500 hover:bg-red-600 text-white",
  neutral:
    "bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100",
};

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  leftIcon,
  className = "",
  children,
  ...rest
}) => {
  const cls = `${base} ${sizeMap[size]} ${variantMap[variant]} ${className}`.trim();
  return (
    <button className={cls} {...rest}>
      {leftIcon && <span className="shrink-0">{leftIcon}</span>}
      {children}
    </button>
  );
};

export default Button;
