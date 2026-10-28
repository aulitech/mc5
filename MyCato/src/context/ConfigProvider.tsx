import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import ota from "../device/ota";
import { useOtaEvent } from "../device/useOtaEvent";
import { getAt, removeAt, setAt, toDevicePath } from "../lib/configPath";
import { errorMessage, notify } from "../lib/notify";
import type { Config, ConfigAction, ConfigPath } from "../types/config";
import { ConfigContext } from "./ConfigContext";

const NO_ACTIONS: ConfigAction[] = [];
const NO_NAMES: string[] = [];

interface SyncOptions {
  /** Path to restore from the last-synced config if the send fails. */
  revertPath?: ConfigPath;
  /** How a successful send changes the last-synced config. */
  applySynced?: (synced: Config) => Config;
}

export const ConfigProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState<Config | null>(null);
  // The config as last confirmed by the device. Failed sends roll the local
  // copy back to this, so the UI never shows a value the device didn't take.
  const syncedRef = useRef<Config | null>(null);

  // ── Load / clear with the connection ───────────────────────────────────────
  useOtaEvent("connect", async () => {
    try {
      const config = await ota.readConfig();
      if (!ota.isConnected()) return; // disconnected while loading
      syncedRef.current = config;
      setData(config);
    } catch (err) {
      notify.error(`Couldn't read Cato's configuration: ${errorMessage(err)}`);
      ota.close().catch(() => {});
    }
  });

  useOtaEvent("disconnect", () => {
    if (data) {
      try {
        localStorage.setItem("DisconnectedConfig", JSON.stringify(data));
      } catch {
        // storage unavailable — nothing to recover from
      }
    }
    syncedRef.current = null;
    setData(null);
  });

  // ── Device sync ────────────────────────────────────────────────────────────
  const sync = useCallback(
    async (path: ConfigPath, value: unknown, options: SyncOptions = {}) => {
      const { revertPath = path, applySynced = (s: Config) => setAt(s, path, value) } = options;
      try {
        await ota.send(`config set ${toDevicePath(path)} ${JSON.stringify(value)}`);
        if (syncedRef.current) syncedRef.current = applySynced(syncedRef.current);
        return true;
      } catch (err) {
        console.error("Error sending config value to device:", err);
        const synced = syncedRef.current;
        if (synced) setData((prev) => prev && setAt(prev, revertPath, getAt(synced, revertPath)));
        return false;
      }
    },
    [],
  );

  const setConfigValue = useCallback((path: ConfigPath, value: unknown) => {
    setData((prev) => prev && setAt(prev, path, value));
  }, []);

  const updateConfig = useCallback(
    async (path: ConfigPath, value: unknown) => {
      setData((prev) => prev && setAt(prev, path, value));
      const ok = await sync(path, value);
      if (!ok) notify.error("Couldn't send that change to Cato, so it was undone.");
      return ok;
    },
    [sync],
  );

  const addConfigItem = useCallback(
    async (path: ConfigPath) => {
      const list = getAt(data, path);
      if (!Array.isArray(list)) return;
      const template = list.length ? structuredClone(list[0]) : {};
      if (template?.name) template.name += " (Copy)";
      const itemPath = [...path, list.length];

      setData((prev) => prev && setAt(prev, itemPath, template));
      const ok = await sync(itemPath, template, { revertPath: path });
      if (!ok) notify.error("Couldn't add the item on Cato, so it was removed.");
    },
    [data, sync],
  );

  const deleteConfigItem = useCallback(
    async (path: ConfigPath) => {
      setData((prev) => prev && removeAt(prev, path));
      const ok = await sync(path, null, {
        revertPath: path.slice(0, -1),
        applySynced: (s) => removeAt(s, path),
      });
      if (!ok) notify.error("Couldn't delete the item on Cato, so it was restored.");
    },
    [sync],
  );

  const replaceConfig = useCallback(
    async (config: Config) => {
      setData(config);
      const parts: ConfigPath[] = [["global_info"], ...config.profiles.map((_, i) => ["profiles", i])];
      let failed = 0;
      for (const part of parts) {
        if (!(await sync(part, getAt(config, part)))) failed += 1;
      }
      if (failed > 0) {
        notify.error(`${failed} part(s) of the configuration couldn't be sent to Cato and were left unchanged.`);
      } else {
        notify.success("Configuration restored. Save it to keep it after a reboot.");
      }
    },
    [sync],
  );

  const saveConfig = useCallback(async () => {
    try {
      await ota.send("config save");
    } catch (err) {
      console.error("Error saving configuration to device:", err);
      notify.error(`Couldn't save the configuration on Cato: ${errorMessage(err)}`);
    }
  }, []);

  const value = useMemo(
    () => ({
      data,
      actionList: data?.global_info?.action_list ?? NO_ACTIONS,
      actionNames: data?.global_info?.action_names ?? NO_NAMES,
      setConfigValue,
      updateConfig,
      addConfigItem,
      deleteConfigItem,
      replaceConfig,
      saveConfig,
    }),
    [data, setConfigValue, updateConfig, addConfigItem, deleteConfigItem, replaceConfig, saveConfig],
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
};
