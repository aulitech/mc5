// templateGen.ts — Gesture template generation and CSV export.
//
// This module is pure JavaScript — no React, no side effects. It takes raw
// gesture recordings and turns them into a compact "fingerprint" for each
// gesture class that can be used for cross-correlation on the device.
//
// The main idea:
//   1. Each recording is trimmed to a 100-sample window centred on the peak
//      of motion (preprocessRecording). This removes the idle time before
//      and after the actual gesture.
//   2. Multiple trimmed recordings for the same class are averaged together
//      sample-by-sample (buildTemplate). The result is a smooth, representative
//      template that cancels out random variation.
//   3. The template can be exported as a CSV file for use in cross-correlation
//      algorithms on the device.
//
// Ported from expense-tracker/mvp/pages/dashboard.js (lines 20-100).

import type { Sample, Template, TemplateChannel } from "../../../types/gestures";

// ── Constants ─────────────────────────────────────────────────────────────────

const MOTION_THS = 20;  // deg/s — gyro magnitude above this = gesture has started
const IDLE_THS   = 15;  // deg/s — gyro magnitude below this = gesture has ended
const THRASH_WIN = 12;  // samples — ignore the first N samples to skip settling motion
const IDLE_MAX   = 60;  // samples — this many consecutive idle samples = gesture is done
export const WIN = 100; // samples — every output window is exactly this long

// Channel order used everywhere a template is flattened (CSV export, charts).
export const TEMPLATE_CHANNELS: TemplateChannel[] = ["acc_x", "acc_y", "acc_z", "gyro_x", "gyro_y", "gyro_z"];

// ── Helpers ───────────────────────────────────────────────────────────────────

// Compute the magnitude (overall speed) of the gyroscope vector.
// This tells us "how fast is the device rotating, in any direction?"
// We use this instead of individual axes because the gesture might rotate
// along any combination of axes.
function gyroMag(sample: Sample) {
  const [gx, gy, gz] = sample.gyro;
  return Math.sqrt(gx * gx + gy * gy + gz * gz);
}

// ── Exported functions ────────────────────────────────────────────────────────

/**
 * Trim a raw recording array to a fixed 100-sample window centred on the
 * gesture peak. Returns null if the window falls out of the recording bounds
 * (e.g. gesture started too late or too early in the buffer).
 *
 * @param samples - Raw IMU samples
 * @returns 100-element slice, or null if unusable
 */
export function preprocessRecording(samples: Sample[]): Sample[] | null {
  let motionStart = 0;

  // Phase 1: skip the "thrash window" — the first few samples where the user
  // may have been pressing Record and the device was still settling.
  // We wait for THRASH_WIN consecutive idle samples before we start looking
  // for the real gesture motion.
  let idleCount = THRASH_WIN / 2;
  while (idleCount < THRASH_WIN && motionStart < samples.length) {
    if (gyroMag(samples[motionStart]) > IDLE_THS) idleCount = 0;
    idleCount++;
    motionStart++;
  }

  // Phase 2: find where the actual gesture motion begins (gyro exceeds threshold).
  while (motionStart < samples.length) {
    if (gyroMag(samples[motionStart]) > MOTION_THS) break;
    motionStart++;
  }

  // Phase 3: find where the gesture ends — when we see IDLE_MAX consecutive
  // idle samples after the motion peak.
  let motionEnd = motionStart;
  let trailingIdle = 0;
  while (motionEnd < samples.length && trailingIdle < IDLE_MAX) {
    if (gyroMag(samples[motionEnd]) < IDLE_THS) trailingIdle++;
    else trailingIdle = 0;
    motionEnd++;
  }
  // Rewind past the idle tail and clamp to the buffer length.
  motionEnd -= trailingIdle;
  motionEnd = Math.min(motionEnd, samples.length);

  // Phase 4: extract a WIN-sample window centred between start and end.
  const center   = Math.floor((motionStart + motionEnd) / 2);
  const winStart = center - Math.floor(WIN / 2);
  const winEnd   = winStart + WIN;

  // If the window extends outside the recording, discard this recording.
  if (winStart < 0 || winEnd > samples.length) return null;
  return samples.slice(winStart, winEnd);
}

/**
 * Compute the root mean square error between a preprocessed recording and a
 * template across all 6 IMU channels. A high RMSE means this recording looks
 * very different from the average — a candidate outlier.
 *
 * Think of it as measuring the "distance" between one recording and the
 * template. If a recording was done at the wrong speed or in the wrong
 * direction, it will have a high RMSE.
 *
 * @param recording - A preprocessRecording() result (100 samples)
 * @param template - buildTemplate() result
 * @returns RMSE across all channels × all time steps
 */
function computeRMSE(recording: Sample[], template: Template) {
  let sum = 0;
  for (let i = 0; i < WIN; i++) {
    const diffs = [
      recording[i].acc[0]  - template.acc_x[i],
      recording[i].acc[1]  - template.acc_y[i],
      recording[i].acc[2]  - template.acc_z[i],
      recording[i].gyro[0] - template.gyro_x[i],
      recording[i].gyro[1] - template.gyro_y[i],
      recording[i].gyro[2] - template.gyro_z[i],
    ];
    for (const d of diffs) sum += d * d;
  }
  return Math.sqrt(sum / (WIN * 6));
}

/**
 * Average multiple preprocessed 100-sample recordings into a single template.
 * Each output channel is the element-wise mean across all valid recordings.
 *
 * @param recordings - Array of preprocessRecording() results (non-null)
 * @returns Each channel is an array of 100 averaged values, or null if no valid input.
 */
export function buildTemplate(recordings: (Sample[] | null)[]): Template | null {
  // Initialise accumulators: one array of WIN zeros per channel.
  const sums = Object.fromEntries(
    TEMPLATE_CHANNELS.map((c) => [c, new Array<number>(WIN).fill(0)]),
  ) as Template;
  let validCount = 0;

  for (const rec of recordings) {
    if (!rec || rec.length !== WIN) continue;
    for (let i = 0; i < WIN; i++) {
      sums.acc_x[i]  += rec[i].acc[0];
      sums.acc_y[i]  += rec[i].acc[1];
      sums.acc_z[i]  += rec[i].acc[2];
      sums.gyro_x[i] += rec[i].gyro[0];
      sums.gyro_y[i] += rec[i].gyro[1];
      sums.gyro_z[i] += rec[i].gyro[2];
    }
    validCount++;
  }

  if (validCount === 0) return null;

  // Divide each accumulated sum by the number of recordings and round to
  // 3 decimal places to keep the output compact.
  return Object.fromEntries(
    TEMPLATE_CHANNELS.map((c) => [
      c,
      sums[c].map((v) => Math.round((v / validCount) * 1000) / 1000),
    ]),
  ) as Template;
}

/**
 * Build a template with automatic outlier rejection using sigma clipping.
 *
 * The process works in two passes:
 *   Pass 1 — build an initial template from every recording, then score each
 *             recording by its RMSE against that template. Recordings that are
 *             very far from the average (> mean + sigma × std) are outliers.
 *   Pass 2 — rebuild the template using only the kept recordings.
 *
 * Think of it like averaging test scores: if most students score 70-80 but one
 * scores 20, that 20 drags the average down and probably represents a recording
 * where the user sneezed or moved wrong. We detect and discard those before
 * computing the final template.
 *
 * @param preprocessed - Array of preprocessRecording() results
 * @param sigma        - Rejection threshold in standard deviations (default 2.0)
 */
export function buildTemplateWithOutlierRejection(
  preprocessed: Sample[][],
  sigma = 2.0,
): { template: Template | null; keptCount: number; totalCount: number } {
  const totalCount = preprocessed.length;

  if (totalCount === 0) return { template: null, keptCount: 0, totalCount: 0 };

  // Pass 1: build an initial template from all recordings.
  const initialTemplate = buildTemplate(preprocessed);
  if (!initialTemplate) return { template: null, keptCount: 0, totalCount };

  // Score each recording against the initial template.
  const scores = preprocessed.map((rec) => computeRMSE(rec, initialTemplate));

  // Compute mean and standard deviation of the RMSE scores.
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length;
  const std = Math.sqrt(variance);

  const threshold = mean + sigma * std;

  // Keep only recordings whose RMSE is within the threshold.
  const kept = preprocessed.filter((_, i) => scores[i] <= threshold);

  // Safety net: if sigma clipping would discard everything, keep them all.
  if (kept.length === 0) {
    return { template: initialTemplate, keptCount: totalCount, totalCount };
  }

  // Pass 2: rebuild template from kept recordings only.
  const template = kept.length < totalCount ? buildTemplate(kept) : initialTemplate;

  return { template, keptCount: kept.length, totalCount };
}

/**
 * Trigger a browser download of a ZIP archive containing one CSV per gesture class.
 * Each CSV has columns: t (0-99), acc_x, acc_y, acc_z, gyro_x, gyro_y, gyro_z
 *
 * @param templates - Output of buildTemplate() per class
 */
export async function exportTemplatesZip(templates: Record<string, Template>) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const cols = TEMPLATE_CHANNELS;

  const gestureNames = Object.keys(templates || {});

  // model_params.csv: first row is space-separated numerical metadata,
  // remaining rows are gesture class names (one per line). The device-side
  // parser tokenizes on whitespace rather than reading line-by-line, so a
  // name containing a space (e.g. "Wrist Flick") would otherwise be read as
  // two separate names — replace spaces with underscores here, in the
  // exported file only. The app reverses this when reading gesture names
  // back from the device (see normalizeGestureList in device/protocol.ts), so the friendly name
  // (with spaces) is what's shown everywhere in the UI.
  const safeGestureNames = gestureNames.map((n) => n.replace(/\s+/g, "_"));
  const paramsLines: (string | number)[] = [
    [gestureNames.length, WIN, cols.length, "10.0"].join(" "),
    ...safeGestureNames,
  ];
  zip.file("model_params.csv", paramsLines.join("\n"));

  Object.values(templates || {}).forEach((template, i) => {
    const n = template[cols[0]]?.length ?? 0;
    const values: (number | string)[] = [];
    for (let t = 0; t < n; t++) {
      for (const c of cols) values.push(template[c][t] ?? "");
    }
    zip.file(`model_templates_${i}.csv`, values.join(" "));
  });

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "xcorr_model.zip";
  a.click();
  URL.revokeObjectURL(url);
}
