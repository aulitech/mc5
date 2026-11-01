import { describe, expect, it } from "vitest";
import { orderGestures, renameIn } from "./gestureOrder";

const classes = [
  { name: "Apple", firstId: 30 },
  { name: "Zebra", firstId: 10 },
  { name: "Mango", firstId: 20 },
];

describe("gesture order", () => {
  it("lists classes in creation order by default, not alphabetically", () => {
    expect(orderGestures([], classes)).toEqual(["Zebra", "Mango", "Apple"]);
  });

  it("keeps the saved list, with gestures that have no recordings, adding new classes at the end", () => {
    expect(orderGestures(["Apple", "Empty", "Zebra"], classes)).toEqual(["Apple", "Empty", "Zebra", "Mango"]);
  });

  it("ignores repeats in a saved order", () => {
    expect(orderGestures(["Mango", "Mango"], classes)).toEqual(["Mango", "Zebra", "Apple"]);
  });

  it("renames in place, or drops the old name when merging", () => {
    expect(renameIn(["a", "b", "c"], "b", "B")).toEqual(["a", "B", "c"]);
    expect(renameIn(["a", "b", "c"], "b", "c")).toEqual(["a", "c"]);
  });
});
