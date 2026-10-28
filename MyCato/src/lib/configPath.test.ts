import { describe, expect, it } from "vitest";
import { getAt, removeAt, setAt, toDevicePath } from "./configPath";

const config = {
  global_info: { name: "Cato", profile_map: [0, 1, 2] },
  profiles: [{ name: "A", pointer: { scale_x: 1 } }, { name: "B" }],
};

describe("configPath", () => {
  it("reads nested values and returns undefined for missing paths", () => {
    expect(getAt(config, ["profiles", 0, "pointer", "scale_x"])).toBe(1);
    expect(getAt(config, ["profiles", 5, "name"])).toBeUndefined();
  });

  it("sets without mutating and shares untouched branches", () => {
    const next = setAt(config, ["profiles", 0, "pointer", "scale_x"], 2);
    expect(getAt(next, ["profiles", 0, "pointer", "scale_x"])).toBe(2);
    expect(getAt(config, ["profiles", 0, "pointer", "scale_x"])).toBe(1);
    expect(Array.isArray(next.profiles)).toBe(true);
    expect(next.profiles[1]).toBe(config.profiles[1]);
    expect(next.global_info).toBe(config.global_info);
  });

  it("splices array items and deletes object keys", () => {
    expect(removeAt(config, ["profiles", 0]).profiles).toEqual([{ name: "B" }]);
    expect(removeAt(config, ["global_info", "name"]).global_info).toEqual({ profile_map: [0, 1, 2] });
    expect(config.profiles).toHaveLength(2);
  });

  it("formats device paths", () => {
    expect(toDevicePath(["profiles", 0, "name"])).toBe("/profiles/0/name");
  });
});
