"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("charlotte-theme", theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("charlotte-theme") === "dark" ? "dark" : "light";
    setTheme(savedTheme);
    applyTheme(savedTheme);
  }, []);

  const isDark = theme === "dark";

  return (
    <button
      className="theme-menu-toggle"
      type="button"
      onClick={() => {
        const nextTheme = isDark ? "light" : "dark";
        setTheme(nextTheme);
        applyTheme(nextTheme);
      }}
    >
      {isDark ? <Moon size={17} /> : <Sun size={17} />}
      <span>{isDark ? "Dark mode" : "Light mode"}</span>
      <i aria-hidden="true"><b /></i>
    </button>
  );
}

