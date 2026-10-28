import { describe, expect, it } from "vitest";
import type { Sample } from "../../../types/gestures";
import { WIN, buildTemplate, buildTemplateWithOutlierRejection, fillGaps, preprocessRecording } from "./templateGen";

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
