import React from "react";

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export const Panel: React.FC<PanelProps> = ({
  padded = true,
  className = "",
  children,
  ...rest
}) => {
  const base =
    "rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm transition";
  const padding = padded ? "p-4" : "";
  const cls = `${base} ${padding} ${className}`.trim();
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
};

export default Panel;

