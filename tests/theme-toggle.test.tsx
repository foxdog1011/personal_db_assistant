/**
 * tests/theme-toggle.test.tsx
 *
 * Tests for useTheme hook — 9 scenarios (4 + 2 + 3):
 *   1. Initial load from localStorage (4)
 *   2. toggleTheme — flips class and persists (2)
 *   3. prefers-color-scheme fallback when no localStorage (3)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTheme } from "@/hooks/useTheme";

// ── matchMedia helper ───────────────────────────────────────────────────────

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

// ── Reset state between tests ────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  mockMatchMedia(false); // default: system prefers light
});

// ── 1. Initial load from localStorage (4 tests) ─────────────────────────────

describe("initial theme — localStorage", () => {
  it("localStorage=dark → adds .dark to documentElement", () => {
    localStorage.setItem("theme", "dark");
    renderHook(() => useTheme());
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("localStorage=light → does NOT add .dark", () => {
    localStorage.setItem("theme", "light");
    renderHook(() => useTheme());
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("localStorage=dark overrides matchMedia prefers-light", () => {
    localStorage.setItem("theme", "dark");
    mockMatchMedia(false); // system says light, localStorage wins
    renderHook(() => useTheme());
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("localStorage=light overrides matchMedia prefers-dark", () => {
    localStorage.setItem("theme", "light");
    mockMatchMedia(true); // system says dark, localStorage wins
    renderHook(() => useTheme());
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});

// ── 2. toggleTheme — flips class and persists (2 tests) ─────────────────────

describe("toggleTheme", () => {
  it("dark → light: removes .dark and saves 'light' to localStorage", () => {
    localStorage.setItem("theme", "dark");
    const { result } = renderHook(() => useTheme());

    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => result.current.toggleTheme());

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("light → dark: adds .dark and saves 'dark' to localStorage", () => {
    localStorage.setItem("theme", "light");
    const { result } = renderHook(() => useTheme());

    expect(document.documentElement.classList.contains("dark")).toBe(false);

    act(() => result.current.toggleTheme());

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("theme")).toBe("dark");
  });
});

// ── 3. prefers-color-scheme fallback — no localStorage (3 tests) ─────────────

describe("prefers-color-scheme fallback (no localStorage)", () => {
  it("system prefers dark → adds .dark", () => {
    mockMatchMedia(true);
    renderHook(() => useTheme());
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("system prefers light → does NOT add .dark", () => {
    mockMatchMedia(false);
    renderHook(() => useTheme());
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("matchMedia unavailable → defaults to light (no .dark)", () => {
    // Simulate an environment where matchMedia throws
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: undefined,
    });
    renderHook(() => useTheme());
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
