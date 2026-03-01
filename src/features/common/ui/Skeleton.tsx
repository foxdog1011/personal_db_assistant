import React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Extra Tailwind classes to control width / height */
  className?: string;
}

/**
 * Single shimmer block — compose to build any skeleton layout.
 * Always renders aria-hidden so screen readers skip placeholder content.
 */
export function Skeleton({ className = "", ...rest }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`}
      {...rest}
    />
  );
}

/**
 * Card-shaped skeleton — three shimmer lines that mimic a note card.
 * role="status" marks it as a live region so assistive tech can announce
 * when real content replaces it.
 */
export function SkeletonCard({ className = "", ...rest }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-3 ${className}`}
      {...rest}
    >
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

/**
 * Stacked list of SkeletonCards — drop-in replacement while note list loads.
 */
export function SkeletonList({ count = 3, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export default Skeleton;
