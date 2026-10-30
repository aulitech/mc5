// standardGestures.ts — Built-in "standard" gesture templates (nod/tilt).
//
// Unlike user-recorded gestures, these ship as pre-built templates in
// public/standard_gestures/*.csv — one file per gesture, in the exact format
// buildTemplatesZip() produces: a single line of space-separated numbers,
// grouped in sixes per timestep as [acc_x, acc_y, acc_z, gyro_x, gyro_y, gyro_z].
// There are no individual recordings behind them, just the template itself.

import type { Sample, Template } from "../../../types/gestures";
import { TEMPLATE_CHANNELS as COLS } from "../lib/templateGen";

export interface StandardGesture {
  id: string;
  label: string;
}

export const STANDARD_GESTURES: StandardGesture[] = [
  { id: "nod_right", label: "Nod Right" },
  { id: "nod_left", label: "Nod Left" },
  { id: "nod_up", label: "Nod Up" },
  { id: "nod_down", label: "Nod Down" },
  { id: "tilt_right", label: "Tilt Right" },
  { id: "tilt_left", label: "Tilt Left" },
];

// Parse one of the CSV files into the same { acc_x, acc_y, ... } shape
// buildTemplate() produces, so it can feed GestureTemplateChart / saveModel /
// buildTemplatesZip without any special-casing.
export function parseTemplateCsv(text: string): Template {
  const values = text.trim().split(/\s+/).map(Number);
  const n = Math.floor(values.length / COLS.length);
  const template = Object.fromEntries(COLS.map((c) => [c, new Array<number>(n)])) as Template;
  for (let t = 0; t < n; t++) {
    for (let c = 0; c < COLS.length; c++) {
      template[COLS[c]][t] = values[t * COLS.length + c];
    }
  }
  return template;
}

// Convert a template back into the per-sample array format the visualizer and
// preprocessRecording() expect: [{ acc: [x,y,z], gyro: [x,y,z] }, ...].
export function templateToSamples(template: Template): Sample[] {
  const n = template.acc_x?.length ?? 0;
  const samples = new Array<Sample>(n);
  for (let t = 0; t < n; t++) {
    samples[t] = {
      acc: [template.acc_x[t], template.acc_y[t], template.acc_z[t]],
      gyro: [template.gyro_x[t], template.gyro_y[t], template.gyro_z[t]],
    };
  }
  return samples;
}

// Cache parsed templates (and in-flight fetches) by id so re-selecting the
// same standard gesture never re-fetches or re-parses.
const cache = new Map<string, Promise<Template>>();

export function loadStandardGestureTemplate(id: string): Promise<Template> {
  if (!cache.has(id)) {
    cache.set(
      id,
      fetch(`/standard_gestures/${id}.csv`)
        .then((res) => {
          if (!res.ok) throw new Error(`Failed to load standard gesture "${id}" (${res.status})`);
          return res.text();
        })
        .then(parseTemplateCsv)
        .catch((err) => {
          cache.delete(id); // don't cache a failure — allow retry next click
          throw err;
        }),
    );
  }
  return cache.get(id)!;
}
