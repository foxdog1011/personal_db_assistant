import React from "react";

export interface SliderProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Text label shown on the left */
  label?: React.ReactNode;
  /** Formatted current value shown on the right */
  valueDisplay?: React.ReactNode;
}

/**
 * Styled range slider.
 * Wraps <input type="range"> with optional left label and right value display.
 */
export function Slider({
  label,
  valueDisplay,
  className = "",
  ...rest
}: SliderProps) {
  return (
    <label
      className={`flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer ${className}`}
    >
      {label !== undefined && (
        <span className="shrink-0 whitespace-nowrap">{label}</span>
      )}
      <input
        type="range"
        className="flex-1 h-1.5 accent-indigo-500 cursor-pointer"
        {...rest}
      />
      {valueDisplay !== undefined && (
        <span className="shrink-0 text-xs font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums min-w-[2rem] text-right">
          {valueDisplay}
        </span>
      )}
    </label>
  );
}

export default Slider;
