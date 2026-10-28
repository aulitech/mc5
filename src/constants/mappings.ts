// mappings.ts — Option lists and code tables for action editing and the
// config tree.

export interface Option<V extends string | number = string | number> {
  value: V;
  label: string;
}

export interface Modifier {
  /** react-simple-keyboard button name, e.g. "{shiftleft}". */
  label: string;
  /** Bit in the HID modifier byte. */
  mask: number;
}

export const ORIENTATION_OPTS: Option<string>[] = [
  { value: "u", label: "Up" },
  { value: "d", label: "Down" },
  { value: "l", label: "Left" },
  { value: "r", label: "Right" },
  { value: "f", label: "Front" },
  { value: "b", label: "Back" },
];

export const DEVICE_TYPES: Option<number>[] = [
  { value: 0, label: "Mouse" },
  { value: 1, label: "Keyboard" },
];

export const MOUSE_OPTS: Option<number>[] = [
  { value: 0, label: "No Button" },
  { value: 1, label: "Left Click" },
  { value: 2, label: "Right Click" },
  { value: 3, label: "Middle Click" },
  { value: 4, label: "Side Button 1 (Back)" },
  { value: 5, label: "Side Button 2 (Forward)" },
];

export const MODIFIERS: Modifier[] = [
  { label: "{controlleft}", mask: 1 },
  { label: "{shiftleft}", mask: 2 },
  { label: "{altleft}", mask: 4 },
  { label: "{metaleft}", mask: 8 },
  { label: "{controlright}", mask: 16 },
  { label: "{shiftright}", mask: 32 },
  { label: "{altright}", mask: 64 },
  { label: "{metaright}", mask: 128 },
];

/** Keyboard key (react-simple-keyboard name) → HID usage code. */
export const KEY_TO_HID: Record<string, number> = {
  "No key": 0,
  a: 4,
  b: 5,
  c: 6,
  d: 7,
  e: 8,
  f: 9,
  g: 10,
  h: 11,
  i: 12,
  j: 13,
  k: 14,
  l: 15,
  m: 16,
  n: 17,
  o: 18,
  p: 19,
  q: 20,
  r: 21,
  s: 22,
  t: 23,
  u: 24,
  v: 25,
  w: 26,
  x: 27,
  y: 28,
  z: 29,
  1: 30,
  2: 31,
  3: 32,
  4: 33,
  5: 34,
  6: 35,
  7: 36,
  8: 37,
  9: 38,
  0: 39,
  "{enter}": 40,
  "{escape}": 41,
  "{backspace}": 42,
  "{tab}": 43,
  "{space}": 44,
  "-": 45,
  "=": 46,
  "[": 47,
  "]": 48,
  "\\": 49,
  ";": 51,
  "'": 52,
  "`": 53,
  ",": 54,
  ".": 55,
  "/": 56,
  "{capslock}": 57,
  "{f1}": 58,
  "{f2}": 59,
  "{f3}": 60,
  "{f4}": 61,
  "{f5}": 62,
  "{f6}": 63,
  "{f7}": 64,
  "{f8}": 65,
  "{f9}": 66,
  "{f10}": 67,
  "{f11}": 68,
  "{f12}": 69,
  "{arrowright}": 79,
  "{arrowleft}": 80,
  "{arrowdown}": 81,
  "{arrowup}": 82,
  "{leftcontrol}": 224,
  "{leftshift}": 225,
  "{leftalt}": 226,
  "{leftmeta}": 227,
  "{rightcontrol}": 228,
  "{rightshift}": 229,
  "{rightalt}": 230,
  "{rightmeta}": 231,
};

export const BUTTON_ACTIONS: Option<string>[] = [
  { value: "tap", label: "Tap" },
  { value: "double_tap", label: "Double Tap" },
  { value: "press", label: "Press" },
  { value: "release", label: "Release" },
  { value: "toggle", label: "Toggle" },
  { value: "hold_until_idle", label: "Hold Until Idle" },
];

export const SCROLL_TYPES: Option<string>[] = [
  { value: "fixed", label: "Fixed" },
  { value: "classic", label: "Classic" },
  { value: "toggle", label: "Toggle" },
  { value: "until_idle", label: "Until Idle" },
];
