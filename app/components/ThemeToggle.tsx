import { useEffect, useState } from "react";

const LIGHT = "nord";
const DARK = "dim";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const raw = document.cookie.match(/\btheme=([^;]+)/)?.[1];
    setIsDark(raw === DARK);
  }, []);

  function toggle() {
    const next = isDark ? LIGHT : DARK;
    setIsDark(!isDark);
    document.documentElement.dataset.theme = next;
    document.cookie = `theme=${next}; path=/; max-age=31536000; SameSite=Lax`;
  }

  return (
    <label className="flex items-center gap-1.5 cursor-pointer" title="Toggle dark mode">
      {/* sun */}
      <svg className={`w-4 h-4 transition-opacity ${isDark ? "opacity-30" : "opacity-100 fill-current"}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1zm0 16a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1zm8-7h1a1 1 0 1 1 0 2h-1a1 1 0 1 1 0-2zM2 12a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1zm15.66-7.07a1 1 0 0 1 0 1.41l-.71.71a1 1 0 1 1-1.41-1.41l.71-.71a1 1 0 0 1 1.41 0zM7.05 16.95a1 1 0 0 1 0 1.41l-.71.71a1 1 0 1 1-1.41-1.41l.71-.71a1 1 0 0 1 1.41 0zM17.66 16.95l.71.71a1 1 0 1 1-1.41 1.41l-.71-.71a1 1 0 0 1 1.41-1.41zM6.34 4.93l.71.71A1 1 0 1 1 5.64 7.05l-.71-.71a1 1 0 0 1 1.41-1.41zM12 7a5 5 0 1 1 0 10A5 5 0 0 1 12 7z"/>
      </svg>

      <input
        type="checkbox"
        className="toggle toggle-sm"
        checked={isDark}
        onChange={toggle}
        aria-label="Toggle dark mode"
      />

      {/* moon */}
      <svg className={`w-4 h-4 transition-opacity ${isDark ? "opacity-100 fill-current" : "opacity-30"}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    </label>
  );
}
