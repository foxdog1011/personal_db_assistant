/**
 * tests/theme-toggle-button.test.tsx
 *
 * Tests for the ThemeToggle component (2 tests):
 *   1. Renders a toggle button in the DOM
 *   2. Clicking it flips .dark on documentElement and persists to localStorage
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { ThemeToggle } from "@/features/common/ui/ThemeToggle";

function mockMatchMedia(prefersDark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" && prefersDark,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  mockMatchMedia(false);
});

describe("ThemeToggle button", () => {
  it("renders an accessible toggle button in the DOM", () => {
    render(<ThemeToggle />);
    expect(
      screen.getByRole("button", { name: /toggle theme/i })
    ).toBeInTheDocument();
  });

  it("clicking toggles .dark on documentElement and persists to localStorage", async () => {
    const user = userEvent.setup();
    localStorage.setItem("theme", "light");

    render(<ThemeToggle />);
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    await user.click(screen.getByRole("button", { name: /toggle theme/i }));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("theme")).toBe("dark");
  });
});
