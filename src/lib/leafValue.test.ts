import { describe, expect, it } from "vitest";
import { clampToRange, parseNumber, textToLeafValue } from "./leafValue";

describe("textToLeafValue", () => {
  it("keeps string leaves as strings, even when the text looks like another type", () => {
    expect(textToLeafValue("2024", "old")).toBe("2024");
    expect(textToLeafValue("true", "old")).toBe("true");
    expect(textToLeafValue("null", "old")).toBe("null");
  });

  it("infers a type only for a null leaf", () => {
    expect(textToLeafValue("12", null)).toBe(12);
    expect(textToLeafValue("false", null)).toBe(false);
    expect(textToLeafValue("", null)).toBeNull();
    expect(textToLeafValue("hi", null)).toBe("hi");
  });
});

describe("clampToRange", () => {
  const range = { min: 100, max: 300, step: 10 };

  it("clamps to min/max", () => {
    expect(clampToRange(5, range)).toBe(100);
    expect(clampToRange(900, range)).toBe(300);
    expect(clampToRange(250, range)).toBe(250);
  });

  it("rounds away float noise at the step's precision", () => {
    expect(clampToRange(0.1 + 0.2, { min: 0, max: 1, step: 0.05 })).toBe(0.3);
  });
});

describe("parseNumber", () => {
  it("rejects blanks and non-numbers", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("-")).toBeNull();
    expect(parseNumber("1e")).toBeNull();
    expect(parseNumber("0.5")).toBe(0.5);
  });
});
