import { createContext, useContext } from "react";

export type Theme = "os" | "light" | "dark";

export interface SettingsContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isAdvanced: boolean;
  setIsAdvanced: (on: boolean) => void;
  /** Shows experimental tabs (currently Gestures); only offered in advanced mode. */
  showExperimental: boolean;
  setShowExperimental: (on: boolean) => void;
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used within a SettingsProvider");
  return context;
};
