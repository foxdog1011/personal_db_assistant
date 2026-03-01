import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ children, className = "", ...rest }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow duration-150 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "", ...rest }: CardProps) {
  return (
    <div
      className={`px-5 py-4 border-b border-gray-100 dark:border-gray-800 font-semibold text-gray-900 dark:text-white ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardBody({ children, className = "", ...rest }: CardProps) {
  return (
    <div className={`p-5 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export default Card;
