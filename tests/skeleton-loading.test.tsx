/**
 * tests/skeleton-loading.test.tsx
 *
 * Visual-consistency tests (4):
 *   1. Skeleton is visible before data resolves
 *   2. Skeleton is removed after data resolves
 *   3. Focus ring class uses var(--primary)
 *   4. Dark mode shows readable skeleton (dark: class present)
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { Skeleton, SkeletonCard } from "@/features/common/ui/Skeleton";
import { Button } from "@/features/common/ui/Button";

// ── Minimal loading wrapper ──────────────────────────────────────────────────

function DataArea({ loading }: { loading: boolean }) {
  if (loading) return <SkeletonCard data-testid="skeleton-card" />;
  return <div data-testid="real-content">Data loaded!</div>;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("skeleton loading", () => {
  it("skeleton is visible before data resolves", () => {
    render(<DataArea loading={true} />);
    expect(screen.getByTestId("skeleton-card")).toBeInTheDocument();
    expect(screen.queryByTestId("real-content")).not.toBeInTheDocument();
  });

  it("skeleton is removed after data resolves", () => {
    render(<DataArea loading={false} />);
    expect(screen.queryByTestId("skeleton-card")).not.toBeInTheDocument();
    expect(screen.getByTestId("real-content")).toBeInTheDocument();
  });

  it("focus ring class uses var(--primary)", () => {
    const { getByRole } = render(<Button>Action</Button>);
    // Class string contains the literal text "var(--primary)" from
    // the Tailwind arbitrary value: focus-visible:ring-[var(--primary)]
    expect(getByRole("button").className).toMatch(/var\(--primary\)/);
  });

  it("dark mode shows readable skeleton (dark: class present)", () => {
    const { container } = render(<Skeleton className="h-4 w-full" />);
    const el = container.firstChild as HTMLElement;
    // Must have animate-pulse for shimmer effect
    expect(el.className).toMatch(/animate-pulse/);
    // Must carry a dark: variant so it stays visible in dark mode
    expect(el.className).toMatch(/dark:/);
  });
});
