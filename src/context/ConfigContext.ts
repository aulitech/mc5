import { createContext, useContext } from "react";
import type { Config, ConfigAction, ConfigPath } from "../types/config";

export interface ConfigContextValue {
  data: Config | null;
  actionList: ConfigAction[];
  actionNames: string[];
  /** Change the local copy only — for drafts like typing or dragging a slider. */
  setConfigValue: (path: ConfigPath, value: unknown) => void;
  /** Change locally and send to the device; rolled back if the send fails. */
  updateConfig: (path: ConfigPath, value: unknown) => Promise<boolean>;
  /** Append a copy of the array's first item (e.g. a new profile). */
  addConfigItem: (path: ConfigPath) => Promise<void>;
  /** Delete an array item. Deleting a profile also re-points the profile map. */
  deleteConfigItem: (path: ConfigPath) => Promise<void>;
  /**
   * Delete an action and re-point every gesture/tap binding to match (see
   * planActionDelete). Resolves false if nothing was deleted.
   */
  deleteAction: (index: number) => Promise<boolean>;
  /**
   * Replace the whole config (restore from backup) and push it to the device.
   * Takes the parsed file as-is; anything that isn't a config is rejected.
   */
  replaceConfig: (config: unknown) => Promise<void>;
  /** Persist the device's working config to flash. */
  saveConfig: () => Promise<void>;
}

export const ConfigContext = createContext<ConfigContextValue | null>(null);

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return context;
};
