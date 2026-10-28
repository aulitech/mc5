// configEdits.ts — Pure helpers for config edits that ripple beyond the path
// being changed: action bindings and the profile map hold *indices*, so
// deleting an action or a profile shifts what they point at.

import type { Config, ConfigPath, Profile } from "../types/config";
import { getSchema } from "../utils/schema";
import { getAt } from "./configPath";

const NO_GESTURE_NAMES: string[] = [];

/** A whole-array replacement to send to the device. */
export interface ArrayChange {
  path: ConfigPath;
  value: number[];
}

/**
 * Paths of every array (e.g. gesture.bindings, tapper.bindings) whose items
 * the UI schema marks as action bindings, within one profile.
 */
export function actionBindingArrays(profile: Profile, profileIndex: number): ConfigPath[] {
  const found: ConfigPath[] = [];
  const walk = (value: unknown, path: ConfigPath) => {
    if (typeof value !== "object" || value === null) return;
    if (Array.isArray(value)) {
      const itemSchema = getSchema([...path, 0], NO_GESTURE_NAMES);
      if (itemSchema?.type === "action_binding") {
        found.push(path);
        return;
      }
      value.forEach((item, i) => walk(item, [...path, i]));
      return;
    }
    for (const [key, child] of Object.entries(value)) walk(child, [...path, key]);
  };
  walk(profile, ["profiles", profileIndex]);
  return found;
}

export interface ActionDeletePlan {
  actionList: Config["global_info"]["action_list"];
  /** Binding arrays that pointed at or past the deleted action, remapped. */
  bindingChanges: ArrayChange[];
  /** How many bindings used the deleted action (now set to the fallback). */
  inUse: number;
  /** Index (in the new list) that bindings to the deleted action now use. */
  fallback: number | null;
}

/**
 * Work out everything that has to change to delete action `index`: the
 * shorter action list, and every binding re-pointed — those after it shift
 * down by one, and those on it move to the "noop" action. Returns null when
 * the action is in use and there's no noop action to fall back to.
 */
export function planActionDelete(config: Config, index: number): ActionDeletePlan | null {
  const actionList = config.global_info.action_list.filter((_, i) => i !== index);
  const noop = actionList.findIndex((a) => a.command === "noop");
  const fallback = noop >= 0 ? noop : null;

  let inUse = 0;
  const bindingChanges: ArrayChange[] = [];
  config.profiles.forEach((profile, p) => {
    for (const path of actionBindingArrays(profile, p)) {
      const bindings = getAt(config, path) as number[];
      let changed = false;
      const next = bindings.map((b) => {
        if (b === index) {
          inUse += 1;
          changed = true;
          return fallback ?? b;
        }
        if (b > index) {
          changed = true;
          return b - 1;
        }
        return b;
      });
      if (changed) bindingChanges.push({ path, value: next });
    }
  });

  if (inUse > 0 && fallback === null) return null;
  return { actionList, bindingChanges, inUse, fallback };
}

/**
 * Re-point the profile map after deleting profile `index`. Entries are
 * profile indices, or -(index + 1) for a skipped connection. Connections that
 * used the deleted profile move to profile 0.
 */
export function remapProfileMap(map: number[], index: number): number[] {
  const shift = (p: number) => (p === index ? 0 : p > index ? p - 1 : p);
  return map.map((entry) => (entry < 0 ? -(shift(-entry - 1) + 1) : shift(entry)));
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Whether parsed JSON has the shape of a config backup. */
export function isConfig(value: unknown): value is Config {
  if (!isPlainObject(value)) return false;
  const { global_info, profiles } = value;
  return (
    isPlainObject(global_info) &&
    Array.isArray(global_info.action_list) &&
    Array.isArray(global_info.profile_map) &&
    Array.isArray(profiles) &&
    profiles.length > 0 &&
    profiles.every(isPlainObject)
  );
}
