import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import ota from "../device/ota";
import { useOtaEvent } from "../device/useOtaEvent";
import { isConfig, planActionDelete, remapProfileMap } from "../lib/configEdits";
import { getAt, removeAt, setAt, toDevicePath } from "../lib/configPath";
import { errorMessage, notify } from "../lib/notify";
import type { Config, ConfigAction, ConfigPath } from "../types/config";
import { ConfigContext } from "./ConfigContext";

const NO_ACTIONS: ConfigAction[] = [];
const NO_NAMES: string[] = [];
const PROFILE_MAP_PATH: ConfigPath = ["global_info", "profile_map"];

interface SyncOptions {
  /** Path to restore from the last-synced config if the send fails. */
  revertPath?: ConfigPath;
  /** How a successful send changes the last-synced config. */
  applySynced?: (synced: Config) => Config;
}

const sameArray = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export const ConfigProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState<Config | null>(null);
  // Mirrors `data` synchronously, so back-to-back edits (two quick "Add"
  // clicks, a multi-step delete) each build on the previous one rather than
  // on the last render.
  const localRef = useRef<Config | null>(null);
  // The config as last confirmed by the device. Failed sends roll the local
  // copy back to this, so the UI never shows a value the device didn't take.
  const syncedRef = useRef<Config | null>(null);

  const update = useCallback((fn: (prev: Config) => Config) => {
    if (!localRef.current) return;
    localRef.current = fn(localRef.current);
    setData(localRef.current);
  }, []);

  const reset = useCallback((config: Config | null) => {
    localRef.current = config;
    syncedRef.current = config;
    setData(config);
  }, []);

  // ── Load / clear with the connection ───────────────────────────────────────
  useOtaEvent("connect", async () => {
    try {
      const { config, unreadProfile } = await ota.readConfig();
      if (!ota.isConnected()) return; // disconnected while loading
      reset(config);
      if (unreadProfile !== undefined) {
        notify.error(
          `Couldn't read profile ${unreadProfile + 1} from Cato, so it and any after it aren't shown. ` +
            "Reconnect before making a backup.",
        );
      }
    } catch (err) {
      notify.error(`Couldn't read Cato's configuration: ${errorMessage(err)}`);
      ota.close().catch(() => {});
    }
  });

  useOtaEvent("disconnect", () => reset(null));

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
        if (synced) update((prev) => setAt(prev, revertPath, getAt(synced, revertPath)));
        return false;
      }
    },
    [update],
  );

  const setConfigValue = useCallback(
    (path: ConfigPath, value: unknown) => update((prev) => setAt(prev, path, value)),
    [update],
  );

  const updateConfig = useCallback(
    async (path: ConfigPath, value: unknown) => {
      update((prev) => setAt(prev, path, value));
      const ok = await sync(path, value);
      if (!ok) notify.error("Couldn't send that change to Cato, so it was undone.");
      return ok;
    },
    [update, sync],
  );

  const addConfigItem = useCallback(
    async (path: ConfigPath) => {
      const list = getAt(localRef.current, path);
      if (!Array.isArray(list)) return;
      const template = list.length ? structuredClone(list[0]) : {};
      if (template?.name) template.name += " (Copy)";
      const itemPath = [...path, list.length];

      update((prev) => setAt(prev, itemPath, template));
      const ok = await sync(itemPath, template, { revertPath: path });
      if (!ok) notify.error("Couldn't add the item on Cato, so it was removed.");
    },
    [update, sync],
  );

  // Profile indices in the profile map shift when a profile is deleted. If the
  // firmware already re-pointed them, adopt its map; otherwise send ours.
  const fixProfileMapAfterDelete = useCallback(
    async (oldMap: number[], deletedIndex: number) => {
      const expected = remapProfileMap(oldMap, deletedIndex);
      try {
        const deviceMap = await ota.send<number[]>(`config get ${toDevicePath(PROFILE_MAP_PATH)}`);
        if (!sameArray(deviceMap, oldMap)) {
          if (syncedRef.current) syncedRef.current = setAt(syncedRef.current, PROFILE_MAP_PATH, deviceMap);
          update((prev) => setAt(prev, PROFILE_MAP_PATH, deviceMap));
          return;
        }
      } catch (err) {
        console.warn("Couldn't read the profile map back after deleting a profile:", err);
      }
      if (!sameArray(expected, oldMap)) await updateConfig(PROFILE_MAP_PATH, expected);
    },
    [update, updateConfig],
  );

  const deleteConfigItem = useCallback(
    async (path: ConfigPath) => {
      const isProfile = path.length === 2 && path[0] === "profiles";
      const oldMap = getAt(localRef.current, PROFILE_MAP_PATH) as number[] | undefined;

      update((prev) => removeAt(prev, path));
      const ok = await sync(path, null, {
        revertPath: path.slice(0, -1),
        applySynced: (s) => removeAt(s, path),
      });
      if (!ok) {
        notify.error("Couldn't delete the item on Cato, so it was restored.");
        return;
      }
      if (isProfile && oldMap) await fixProfileMapAfterDelete(oldMap, Number(path[1]));
    },
    [update, sync, fixProfileMapAfterDelete],
  );

  const deleteAction = useCallback(
    async (index: number) => {
      const config = localRef.current;
      if (!config) return false;
      const plan = planActionDelete(config, index);
      if (!plan) {
        notify.error("That action is still bound to a gesture or tap, and there's no “Do Nothing” action to replace it with.");
        return false;
      }
      if (!(await updateConfig(["global_info", "action_list"], plan.actionList))) return false;

      let failed = 0;
      for (const change of plan.bindingChanges) {
        update((prev) => setAt(prev, change.path, change.value));
        if (!(await sync(change.path, change.value))) failed += 1;
      }
      if (failed > 0) {
        notify.error(
          `The action was deleted, but ${failed} binding list(s) couldn't be updated and may now point at the wrong action. Check the Profile tab.`,
        );
      }
      return true;
    },
    [update, updateConfig, sync],
  );

  const replaceConfig = useCallback(
    async (config: unknown) => {
      if (!isConfig(config)) {
        notify.error("That file isn't a Cato configuration backup.");
        return;
      }
      const deviceProfileCount = syncedRef.current?.profiles.length ?? 0;
      update(() => config);

      const parts: ConfigPath[] = [["global_info"], ...config.profiles.map((_, i) => ["profiles", i])];
      let failed = 0;
      for (const part of parts) {
        if (!(await sync(part, getAt(config, part)))) failed += 1;
      }
      // Remove device profiles beyond the backup's, last first so indices hold.
      for (let i = deviceProfileCount - 1; i >= config.profiles.length; i--) {
        const path: ConfigPath = ["profiles", i];
        const ok = await sync(path, null, { revertPath: ["profiles"], applySynced: (s) => removeAt(s, path) });
        if (!ok) failed += 1;
      }

      if (failed > 0) {
        notify.error(`${failed} part(s) of the configuration couldn't be sent to Cato and were left unchanged.`);
      } else {
        notify.success("Configuration restored. Save it to keep it after a reboot.");
      }
    },
    [update, sync],
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
      deleteAction,
      replaceConfig,
      saveConfig,
    }),
    [data, setConfigValue, updateConfig, addConfigItem, deleteConfigItem, deleteAction, replaceConfig, saveConfig],
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
};
