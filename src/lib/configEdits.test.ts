import { describe, expect, it } from "vitest";
import { CONFIG_DATA } from "../constants/schemas";
import type { Config } from "../types/config";
import { actionBindingArrays, isConfig, planActionDelete, remapProfileMap } from "./configEdits";

const config = (): Config => structuredClone(CONFIG_DATA);

describe("actionBindingArrays", () => {
  it("finds the gesture and tapper binding lists via the UI schema", () => {
    expect(actionBindingArrays(CONFIG_DATA.profiles[0], 0)).toEqual([
      ["profiles", 0, "gesture", "bindings"],
      ["profiles", 0, "tapper", "bindings"],
    ]);
  });
});

describe("planActionDelete", () => {
  it("shifts later bindings down and moves bindings on the deleted action to noop", () => {
    // Action 1 is "Left Click"; profile 0 taps [0, 1, 2, 4], gestures use 6 and 8.
    const plan = planActionDelete(config(), 1)!;
    expect(plan.actionList).toHaveLength(CONFIG_DATA.global_info.action_list.length - 1);
    expect(plan.fallback).toBe(0);
    expect(plan.inUse).toBe(3); // tap binding in each of the 3 profiles
    expect(plan.bindingChanges).toContainEqual({ path: ["profiles", 0, "tapper", "bindings"], value: [0, 0, 1, 3] });
    expect(plan.bindingChanges).toContainEqual({
      path: ["profiles", 0, "gesture", "bindings"],
      value: [0, 0, 0, 0, 5, 0, 7, 0],
    });
  });

  it("leaves bindings before the deleted action alone", () => {
    // The last action ("/ Key", 17) is the last gesture binding in profiles 1 and 2.
    const last = CONFIG_DATA.global_info.action_list.length - 1;
    const plan = planActionDelete(config(), last)!;
    expect(plan.inUse).toBe(2);
    expect(plan.bindingChanges).toEqual([
      { path: ["profiles", 1, "gesture", "bindings"], value: [0, 0, 15, 13, 12, 14, 16, 0] },
      { path: ["profiles", 2, "gesture", "bindings"], value: [0, 0, 15, 13, 12, 14, 16, 0] },
    ]);
  });

  it("refuses when the action is in use and there's no noop to fall back to", () => {
    const c = config();
    c.global_info.action_list = c.global_info.action_list.filter((a) => a.command !== "noop");
    // Now index 0 is "Left Click", bound to every profile's tapper.
    expect(planActionDelete(c, 0)).toBeNull();
  });
});

describe("remapProfileMap", () => {
  it("shifts later profiles, sends the deleted one's connections to profile 0, keeps skips", () => {
    expect(remapProfileMap([0, 1, 2], 1)).toEqual([0, 0, 1]);
    // -3 is "skipped, was profile 2" → "skipped, was profile 1"
    expect(remapProfileMap([2, -3, 0], 1)).toEqual([1, -2, 0]);
    expect(remapProfileMap([-2], 1)).toEqual([-1]);
  });
});

describe("isConfig", () => {
  it("accepts a config and rejects other JSON", () => {
    expect(isConfig(CONFIG_DATA)).toBe(true);
    expect(isConfig(null)).toBe(false);
    expect(isConfig({ profiles: [] })).toBe(false);
    expect(isConfig({ ...CONFIG_DATA, profiles: [] })).toBe(false);
    expect(isConfig({ ...CONFIG_DATA, profiles: ["x"] })).toBe(false);
  });
});
