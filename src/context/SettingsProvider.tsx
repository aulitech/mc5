import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SettingsContext, type Theme } from "./SettingsContext";

const readStorage = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage unavailable — preference just won't persist
  }
};

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(
    () => (readStorage("theme") as Theme | null) ?? "os",
  );
  const [isAdvanced, setIsAdvanced] = useState(() => readStorage("isAdvanced") === "true");
  const [showExperimental, setShowExperimental] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "os") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    writeStorage("theme", theme === "os" ? null : theme);
  }, [theme]);

  useEffect(() => {
    writeStorage("isAdvanced", String(isAdvanced));
  }, [isAdvanced]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      isAdvanced,
      setIsAdvanced,
      showExperimental,
      setShowExperimental,
    }),
    [theme, isAdvanced, showExperimental],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};
