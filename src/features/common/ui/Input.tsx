import React from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Optional icon/element rendered on the left inside the input */
  prefixIcon?: React.ReactNode;
}

const inputBase =
  "w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 " +
  "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 " +
  "placeholder-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] " +
  "transition py-2";

export function Input({ prefixIcon, className = "", ...rest }: InputProps) {
  if (prefixIcon) {
    return (
      <div className="relative">
        <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
          {prefixIcon}
        </span>
        <input
          className={`${inputBase} pl-9 pr-3 ${className}`}
          {...rest}
        />
      </div>
    );
  }
  return (
    <input className={`${inputBase} px-3 ${className}`} {...rest} />
  );
}

export default Input;
