#!/usr/bin/env node
// contrast-audit.mjs — WCAG contrast check of the theme tokens in
// src/styles/index.css, for both light and dark mode.
//
//   node scripts/contrast-audit.mjs        # report; exits 1 if any pair fails
//
// Each pair is [foreground token, background token, minimum ratio]. 4.5 is
// WCAG AA for normal text; 3 is the minimum for large/bold text and for UI
// parts that must be seen (input borders, focus rings, icons, state colours).
// Add a pair whenever a new fg/bg combination appears in the UI.

import { readFileSync } from "node:fs";

const TEXT = 4.5;
const UI = 3;

const PAIRS = [
  // Page and cards
  ["--color", "--bg", TEXT],
  ["--color", "--bg-card", TEXT],
  ["--color-card", "--bg-card", TEXT],
  ["--color-muted", "--bg-card", TEXT],
  ["--color-input", "--bg-card", TEXT], // labels/values drawn on cards
  // Header
  ["--color-header", "--bg-header", TEXT],
  ["--color-button", "--bg-header", TEXT],
  ["--color-brand", "--bg-header", TEXT],
  ["--color-card", "--bg-header", TEXT], // device name / profile in the logo
  // Toolbar and tabs
  ["--color-toolbar", "--bg-toolbar", TEXT],
  ["--color-button", "--bg-toolbar", TEXT],
  // (the active tab is --color-card on --bg-card, above)
  ["--color-button", "--bg-card", TEXT],
  // Button states
  ["--color-button-hover", "--bg-button-hover", TEXT],
  ["--color-button-active", "--bg-button-active", TEXT],
  ["--color-on-primary", "--primary", TEXT],
  ["--color-on-primary", "--primary-hover", TEXT],
  // Inputs
  ["--color-input", "--bg-input", TEXT],
  ["--input-border", "--bg-card", UI],
  ["--input-border", "--bg-input", UI],
  ["--focus-ring", "--bg-card", UI],
  ["--focus-ring", "--bg-toolbar", UI],
  ["--focus-ring", "--bg-header", UI],
  // Selection / hover rows
  ["--color-card", "--bg-hover", TEXT],
  ["--color-card", "--bg-selected", TEXT],
  ["--primary", "--bg-card", UI], // selected-row outline, accents
  // Drag handles (muted) on hovered and selected rows
  ["--color-muted", "--bg-hover", UI],
  ["--color-muted", "--bg-selected", UI],
  // Edit (green) / delete (red) icons on hovered and selected rows
  ["--success", "--bg-hover", UI],
  ["--success", "--bg-selected", UI],
  ["--danger", "--bg-hover", UI],
  ["--danger", "--bg-selected", UI],
  // Status colours (icons, active indicators, toasts' accent bar)
  // Danger is also text: delete buttons, the toolbar's "Save"/"DC" indicators.
  ["--danger", "--bg-card", TEXT],
  ["--danger", "--bg-input", UI], // icons only; no red text sits on inputs
  ["--success", "--bg-card", UI],
  ["--led-blue", "--bg-card", UI],
  ["--led-blue", "--bg-header", UI],
  // Code
  ["--color-code", "--bg-code", TEXT],
  // Practice confidence bars and other progress fills, on their track
  ["--warning", "--bg-input", UI],
  ["--primary", "--bg-input", UI],
  // Read-only badge
  ["--warning", "--bg-card", TEXT],
  ["--success", "--bg-input", UI],
  // Tooltips
  ["--tooltip-color", "--tooltip-bg", TEXT],
  // Template chart: lines and labels on the panel
  ["--chart-1", "--bg-input", UI],
  ["--chart-2", "--bg-input", UI],
  ["--chart-3", "--bg-input", UI],
  ["--color-card", "--bg-input", TEXT],
  ["--color-muted", "--bg", TEXT],
  // 3D viewer: darkest model shade and deepest axis colour (fixed in
  // GestureVisualizer.tsx) on the viewer panel
  ["--viz-color", "--viz-bg", TEXT],
  // Recording timer track drawn over the viewer; the playback timeline's
  // ticks and labels (--viz-color) and playhead (--viz-danger)
  ["--viz-danger", "--viz-bg", UI],
  ["--viz-success", "--viz-bg", UI],
  ["#808080", "--viz-bg", UI],
  ["#f57f17", "--viz-bg", UI],
];

// ── Colour maths ──────────────────────────────────────────────────────────────

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => v * 255);
}

function parseColor(text) {
  const t = text.trim();
  let m = t.match(/^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/);
  if (m) return hslToRgb(+m[1], +m[2], +m[3]);
  m = t.match(/^#([0-9a-f]{6})$/i);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  m = t.match(/^#([0-9a-f]{3})$/i);
  if (m) return [...m[1]].map((c) => parseInt(c + c, 16));
  return null;
}

const luminance = ([r, g, b]) => {
  const lin = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// ── Token resolution ──────────────────────────────────────────────────────────

const css = readFileSync(new URL("../src/styles/index.css", import.meta.url), "utf8");
const rootBlock = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
const tokens = {};
for (const [, name, value] of rootBlock.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
  tokens[name] = value.replace(/\s+/g, " ").trim();
}

function resolve(value, mode, seen = new Set()) {
  let v = value.trim();
  const ld = v.match(/^light-dark\((.*)\)$/);
  if (ld) {
    // split on the top-level comma
    let depth = 0;
    let cut = -1;
    for (let i = 0; i < ld[1].length; i++) {
      const c = ld[1][i];
      if (c === "(") depth++;
      else if (c === ")") depth--;
      else if (c === "," && depth === 0) cut = i;
    }
    v = mode === "light" ? ld[1].slice(0, cut) : ld[1].slice(cut + 1);
    return resolve(v, mode, seen);
  }
  const ref = v.match(/^var\((--[\w-]+)\)$/);
  if (ref) {
    if (seen.has(ref[1]) || !(ref[1] in tokens)) return null;
    seen.add(ref[1]);
    return resolve(tokens[ref[1]], mode, seen);
  }
  return parseColor(v);
}

// ── Report ────────────────────────────────────────────────────────────────────

let failures = 0;
for (const mode of ["light", "dark"]) {
  console.log(`\n${mode.toUpperCase()}`);
  for (const [fg, bg, min] of PAIRS) {
    const a = fg.startsWith("#") ? parseColor(fg) : fg in tokens ? resolve(tokens[fg], mode) : null;
    const b = bg in tokens ? resolve(tokens[bg], mode) : null;
    if (!a || !b) {
      failures++;
      console.log(`  ✗ ${fg} on ${bg}: ${!a ? fg : bg} is undefined`);
      continue;
    }
    const ratio = contrast(a, b);
    const ok = ratio >= min;
    if (!ok) failures++;
    console.log(`  ${ok ? "✓" : "✗"} ${ratio.toFixed(2).padStart(5)} (min ${min})  ${fg} on ${bg}`);
  }
}
console.log(failures ? `\n${failures} failing pair(s)` : "\nAll pairs pass");
process.exit(failures ? 1 : 0);
