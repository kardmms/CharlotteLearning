"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function applyAppearance(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("charlotte-theme", theme);
}

export function AppearanceControls() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("charlotte-theme") === "dark" ? "dark" : "light";
    setTheme(savedTheme);
    applyAppearance(savedTheme);
  }, []);

  function chooseTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    applyAppearance(nextTheme);
  }

  return (
    <div className="appearance-grid">
      <section className="panel appearance-card">
        <div>
          <div className="eyebrow">Theme</div>
          <h2>Light or dark</h2>
          <p>Choose the workspace tone that feels easiest to read.</p>
        </div>
        <div className="segmented-control">
          <button
            className={theme === "light" ? "active" : ""}
            type="button"
            onClick={() => chooseTheme("light")}
          >
            <Sun size={18} />
            Light
          </button>
          <button
            className={theme === "dark" ? "active" : ""}
            type="button"
            onClick={() => chooseTheme("dark")}
          >
            <Moon size={18} />
            Dark
          </button>
        </div>
      </section>
    </div>
  );
}
