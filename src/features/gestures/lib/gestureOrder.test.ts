import { describe, expect, it } from "vitest";
import { moveTo, orderGestures, renameIn } from "./gestureOrder";

const classes = [
  { name: "Apple", firstId: 30 },
  { name: "Zebra", firstId: 10 },
  { name: "Mango", firstId: 20 },
];

describe("gesture order", () => {
  it("lists classes in creation order by default, not alphabetically", () => {
    expect(orderGestures([], classes)).toEqual(["Zebra", "Mango", "Apple"]);
  });

  it("keeps the saved order, dropping deleted classes and adding new ones at the end", () => {
    expect(orderGestures(["Apple", "Gone", "Zebra"], classes)).toEqual(["Apple", "Zebra", "Mango"]);
  });

  it("ignores repeats in a saved order", () => {
    expect(orderGestures(["Mango", "Mango"], classes)).toEqual(["Mango", "Zebra", "Apple"]);
  });

  it("moves a name to a position", () => {
    expect(moveTo(["a", "b", "c", "d"], "a", 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveTo(["a", "b", "c", "d"], "d", 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveTo(["a", "b"], "b", 9)).toEqual(["a", "b"]);
    expect(moveTo(["a", "b"], "x", 0)).toEqual(["a", "b"]);
  });

  it("renames in place, or drops the old name when merging", () => {
    expect(renameIn(["a", "b", "c"], "b", "B")).toEqual(["a", "B", "c"]);
    expect(renameIn(["a", "b", "c"], "b", "c")).toEqual(["a", "c"]);
  });
});
