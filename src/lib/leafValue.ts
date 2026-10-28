// leafValue.ts — Turning what the user typed into the value a config leaf
// should hold. A leaf keeps the type it was read with; only a leaf that is
// currently null has its type guessed from the text.

export interface NumberRange {
  min: number;
  max: number;
  step: number;
}

/** Decimal places implied by a step, e.g. 0.05 → 2. */
export const stepPrecision = (step: number) => step.toString().split(".")[1]?.length ?? 0;

/** Round to the step's precision (avoiding float noise) and clamp to range. */
export function clampToRange(value: number, { min, max, step }: NumberRange) {
  const rounded = Number(value.toFixed(stepPrecision(step)));
  return Math.min(max, Math.max(min, rounded));
}

/** Parse a typed number; null if it isn't one. */
export function parseNumber(text: string): number | null {
  if (text.trim() === "") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/**
 * Value for text typed into a leaf that held `previous`. Strings stay
 * strings (a name of "2024" or "true" is still text); only a null leaf infers
 * number/boolean/null from the text.
 */
export function textToLeafValue(text: string, previous: unknown): unknown {
  if (previous !== null) return text;
  if (text === "null" || text === "") return null;
  if (text === "true") return true;
  if (text === "false") return false;
  return parseNumber(text) ?? text;
}
