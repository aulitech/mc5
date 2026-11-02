import { describe, expect, it } from "vitest";
import type { Sample, Template } from "../../../types/gestures";
import {
  WIN,
  buildModelFiles,
  buildTemplate,
  buildTemplateWithOutlierRejection,
  fillGaps,
  parseModelFiles,
  preprocessRecording,
} from "./templateGen";

const still = (): Sample => ({ acc: [0, 0, 9.8], gyro: [0, 0, 0] });
const moving = (rate: number): Sample => ({ acc: [0, 0, 9.8], gyro: [rate, 0, 0] });

// idle lead-in, a burst of rotation, then idle tail
function recording(leadIn: number, burst: number, tail: number, rate = 100): Sample[] {
  return [
    ...Array.from({ length: leadIn }, still),
    ...Array.from({ length: burst }, () => moving(rate)),
    ...Array.from({ length: tail }, still),
  ];
}

describe("preprocessRecording", () => {
  it("returns a WIN-sample window centred on the motion", () => {
    const window = preprocessRecording(recording(80, 30, 140));
    expect(window).toHaveLength(WIN);
    const movingIdx = window!.flatMap((s, i) => (s.gyro[0] > 0 ? [i] : []));
    const centre = (movingIdx[0] + movingIdx[movingIdx.length - 1]) / 2;
    expect(Math.abs(centre - WIN / 2)).toBeLessThanOrEqual(2);
  });

  it("rejects recordings where the window would run off the end", () => {
    expect(preprocessRecording(recording(20, 30, 30))).toBeNull();
  });
});

describe("buildTemplate", () => {
  it("averages recordings channel by channel", () => {
    const a = Array.from({ length: WIN }, () => moving(10));
    const b = Array.from({ length: WIN }, () => moving(30));
    const template = buildTemplate([a, b])!;
    expect(template.gyro_x).toHaveLength(WIN);
    expect(template.gyro_x.every((v) => v === 20)).toBe(true);
    expect(template.acc_z[0]).toBe(9.8);
  });

  it("returns null with no usable recordings", () => {
    expect(buildTemplate([null])).toBeNull();
  });
});

describe("buildTemplateWithOutlierRejection", () => {
  it("drops a recording far from the rest", () => {
    const typical = Array.from({ length: 9 }, (_, i) => Array.from({ length: WIN }, () => moving(50 + i)));
    const outlier = Array.from({ length: WIN }, () => moving(500));
    const { template, keptCount, totalCount } = buildTemplateWithOutlierRejection([...typical, outlier]);
    expect(totalCount).toBe(10);
    expect(keptCount).toBe(9);
    expect(template!.gyro_x[0]).toBe(54);
  });
});

describe("fillGaps", () => {
  const at = (ts: number, rate: number): Sample => ({ ts, acc: [0, 0, 9.8], gyro: [rate, 0, 0] });

  it("interpolates samples lost from a steady stream", () => {
    // 10-unit cadence with three samples missing between ts 30 and ts 70.
    const filled = fillGaps([at(0, 0), at(10, 0), at(20, 0), at(30, 0), at(70, 40), at(80, 40)]);
    expect(filled.map((s) => s.ts)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80]);
    expect(filled.slice(3, 8).map((s) => s.gyro[0])).toEqual([0, 10, 20, 30, 40]);
  });

  it("leaves gap-free and untimed recordings alone", () => {
    const steady = [at(0, 1), at(10, 2), at(20, 3)];
    expect(fillGaps(steady)).toEqual(steady);
    const untimed = recording(5, 5, 5);
    expect(fillGaps(untimed)).toBe(untimed);
  });
});

describe("buildModelFiles", () => {
  it("lists the gestures in model_params.csv, then one template file each, in order", () => {
    const flat = (v: number): Template => ({ acc_x: [v], acc_y: [v], acc_z: [v], gyro_x: [v], gyro_y: [v], gyro_z: [v] });
    expect(buildModelFiles([["Wrist Flick", flat(1)], ["Nod Up", flat(2)]])).toEqual([
      ["model_params.csv", `2 ${WIN} 6 10.0\nWrist_Flick\nNod_Up`],
      ["model_templates_0.csv", "1 1 1 1 1 1"],
      ["model_templates_1.csv", "2 2 2 2 2 2"],
    ]);
  });
});

describe("parseModelFiles", () => {
  const template = (seed: number): Template =>
    Object.fromEntries(
      ["acc_x", "acc_y", "acc_z", "gyro_x", "gyro_y", "gyro_z"].map((c, k) => [
        c,
        Array.from({ length: WIN }, (_, t) => Math.round((seed + k * 10 + Math.sin(t / 7) * 30) * 1000) / 1000),
      ]),
    ) as Template;

  it("reads back what buildModelFiles writes, one window-long take per class", async () => {
    const files = new Map(buildModelFiles([["Wrist Flick", template(1)], ["yes", template(2)]]));
    const takes = await parseModelFiles(files.get("model_params.csv")!, async (i) => files.get(`model_templates_${i}.csv`)!);
    expect(takes.map((t) => t.gestureName)).toEqual(["Wrist Flick", "yes"]);
    expect(takes[0].data).toHaveLength(WIN);
    expect(takes[0].data[1]).toEqual({
      ts: 10,
      acc: [template(1).acc_x[1], template(1).acc_y[1], template(1).acc_z[1]],
      gyro: [template(1).gyro_x[1], template(1).gyro_y[1], template(1).gyro_z[1]],
    });
    // Built into a template again (Install), each take gives back its template.
    expect(buildTemplate([preprocessRecording(takes[1].data)])).toEqual(template(2));
  });

  it("explains files that aren't a model", async () => {
    const none = async () => "";
    await expect(parseModelFiles("2 100 6 10.0\nyes", none)).rejects.toThrow("doesn't list the model's gestures");
    await expect(parseModelFiles("1 50 6 10.0\nyes", none)).rejects.toThrow("aren't 100 samples of 6 values");
    await expect(parseModelFiles("1 100 6 10.0\nyes", async () => "1 2 3")).rejects.toThrow(
      'model_templates_0.csv ("yes") isn\'t 100 rows of 6 numbers.',
    );
  });
});
