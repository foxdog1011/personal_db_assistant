import { useState, useEffect } from "react";

export type Theme = "dark" | "light";

/** Read theme from localStorage, falling back to matchMedia, then 'light'. */
function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // localStorage unavailable (SSR or restricted context)
  }
  try {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  } catch {
    // matchMedia unavailable
  }
  return "light";
}

/**
 * Manages dark/light theme.
 * - Applies/removes `.dark` on `document.documentElement`
 * - Persists selection to `localStorage["theme"]`
 * - Reads `prefers-color-scheme` when no stored value exists
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // ignore write errors
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, toggleTheme };
}
