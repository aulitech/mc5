import { describe, expect, it } from "vitest";
import { getSchema, isShown } from "./schema";

const off = { isAdvanced: false, showExperimental: false };
const advanced = { isAdvanced: true, showExperimental: false };
const experimental = { isAdvanced: true, showExperimental: true };

describe("isShown", () => {
  it("shows basic and unmarked nodes always, hidden ones never", () => {
    expect(isShown(null, off)).toBe(true);
    expect(isShown({ mode: "basic" }, off)).toBe(true);
    expect(isShown({ mode: "hidden" }, experimental)).toBe(false);
  });

  it("shows advanced nodes in advanced mode", () => {
    expect(isShown({ mode: "advanced" }, off)).toBe(false);
    expect(isShown({ mode: "advanced" }, advanced)).toBe(true);
  });

  it("shows experimental nodes only with Advanced and Experimental both on", () => {
    expect(isShown({ mode: "experimental" }, off)).toBe(false);
    expect(isShown({ mode: "experimental" }, advanced)).toBe(false);
    expect(isShown({ mode: "experimental" }, { isAdvanced: false, showExperimental: true })).toBe(false);
    expect(isShown({ mode: "experimental" }, experimental)).toBe(true);
  });

  it("puts Orientation behind the Experimental switch", () => {
    const orientation = getSchema(["global_info", "orientation"], []);
    expect(isShown(orientation, advanced)).toBe(false);
    expect(isShown(orientation, experimental)).toBe(true);
  });
});
