import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'platform_theme_config';

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveConfig(cfg) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {}
}

function isInDarkRange(start, end) {
  const hour = new Date().getHours();
  if (start <= end) {
    // e.g. 8 → 20 (dark during those hours)
    return hour >= start && hour < end;
  }
  // e.g. 18 → 6 (dark from 18 to midnight, and midnight to 6)
  return hour >= start || hour < end;
}

export function ThemeProvider({ children }) {
  const saved = useRef(loadConfig());

  const [theme, setTheme] = useState(saved.current?.theme || 'light');
  const [themeMode, setThemeModeRaw] = useState(saved.current?.themeMode || 'manual');
  const [scheduleStart, setScheduleStartRaw] = useState(saved.current?.scheduleStart ?? 18);
  const [scheduleEnd, setScheduleEndRaw] = useState(saved.current?.scheduleEnd ?? 6);

  // Persist whenever config changes
  useEffect(() => {
    saveConfig({ theme, themeMode, scheduleStart, scheduleEnd });
  }, [theme, themeMode, scheduleStart, scheduleEnd]);

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  // Auto mode: follow system preference
  useEffect(() => {
    if (themeMode !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (e) => setTheme(e.matches ? 'dark' : 'light');
    apply(mq);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [themeMode]);

  // Schedule mode: check every minute
  useEffect(() => {
    if (themeMode !== 'schedule') return;
    const check = () => setTheme(isInDarkRange(scheduleStart, scheduleEnd) ? 'dark' : 'light');
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [themeMode, scheduleStart, scheduleEnd]);

  const toggleTheme = useCallback(() => {
    if (themeMode !== 'manual') return;
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, [themeMode]);

  const setThemeMode = useCallback((mode) => {
    setThemeModeRaw(mode);
  }, []);

  const setScheduleStart = useCallback((h) => setScheduleStartRaw(h), []);
  const setScheduleEnd = useCallback((h) => setScheduleEndRaw(h), []);

  return (
    <ThemeContext.Provider value={{
      theme,
      toggleTheme,
      themeMode,
      setThemeMode,
      scheduleStart,
      setScheduleStart,
      scheduleEnd,
      setScheduleEnd,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
};
