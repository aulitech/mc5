// GestureTemplateChart.tsx — SVG chart showing a gesture template's 6 channels.
//
// Renders two panels stacked vertically:
//   Top panel:    Gyroscope (X=red, Y=green, Z=blue)
//   Bottom panel: Accelerometer (X=red, Y=green, Z=blue)
//
// Each panel shows 100 time-samples (the template output from buildTemplate).
// Pure SVG — no canvas, no external chart library needed.
//
// Ported directly from expense-tracker/mvp/components/GestureTemplateChart.js
// with no logic changes.

import type { Template, TemplateChannel } from "../../../types/gestures";

const MARGIN = { left: 48, right: 15, top: 10, bottom: 30 };
const PANEL_H = 90;
const GAP = 18;
const CHART_W = 380;
const CHART_H = MARGIN.top + PANEL_H + GAP + PANEL_H + MARGIN.bottom;

// X=red, Y=green, Z=blue — matches matplotlib default colour cycle
const COLORS = ["#e53935", "#43a047", "#1e88e5"];

// Compute the min/max of an array and add a small padding so traces don't
// sit right on the panel edge.
function dataRange(arr: number[]): [number, number] {
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const pad = (max - min) * 0.06 || 1;
  return [min - pad, max + pad];
}

// Convert an array of numeric values into an SVG polyline points string.
// Each value maps to an (x, y) coordinate inside the panel rectangle.
function toPolylinePoints(
  values: number[] | undefined,
  plotW: number,
  yMin: number,
  yMax: number,
  panelTop: number,
  panelH: number,
) {
  if (!values || values.length === 0) return "";
  const n = values.length;
  return values
    .map((v, i) => {
      const x = MARGIN.left + (i / (n - 1)) * plotW;
      const y = panelTop + panelH * (1 - (v - yMin) / (yMax - yMin));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

// Y-axis tick labels: top, middle, bottom of each panel.
function YTicks({ x, panelTop, panelH, min, max }: { x: number; panelTop: number; panelH: number; min: number; max: number }) {
  const mid = (min + max) / 2;
  const ticks = [
    { y: panelTop + 4, val: max },
    { y: panelTop + panelH / 2, val: mid },
    { y: panelTop + panelH - 2, val: min },
  ];
  return (
    <>
      {ticks.map(({ y, val }) => (
        <text key={val} x={x} y={y} textAnchor="end" fontSize={8} fill="#bbb">
          {val.toFixed(1)}
        </text>
      ))}
    </>
  );
}

export default function GestureTemplateChart({ template, gestureName }: { template: Template; gestureName: string }) {
  const plotW = CHART_W - MARGIN.left - MARGIN.right;

  const gyroTop = MARGIN.top;
  const accTop  = MARGIN.top + PANEL_H + GAP;

  const gyroCols: TemplateChannel[] = ["gyro_x", "gyro_y", "gyro_z"];
  const accCols: TemplateChannel[]  = ["acc_x",  "acc_y",  "acc_z"];

  const allGyro = gyroCols.flatMap((c) => template[c] || []);
  const allAcc  = accCols.flatMap((c)  => template[c] || []);

  const [gyroMin, gyroMax] = dataRange(allGyro);
  const [accMin,  accMax]  = dataRange(allAcc);

  return (
    <div>
      <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.8rem", fontWeight: 600 }}>{gestureName}</p>
      <svg width={CHART_W} height={CHART_H} style={{ fontFamily: "sans-serif", display: "block" }}>
        {/* ── Gyro panel ── */}
        <rect x={MARGIN.left} y={gyroTop} width={plotW} height={PANEL_H} fill="#fafafa" stroke="#ddd" />
        <text
          transform={`translate(11, ${gyroTop + PANEL_H / 2}) rotate(-90)`}
          textAnchor="middle" fontSize={9} fill="#aaa"
        >
          Gyro (d/s)
        </text>
        <YTicks x={MARGIN.left - 3} panelTop={gyroTop} panelH={PANEL_H} min={gyroMin} max={gyroMax} />
        {gyroCols.map((col, i) => (
          <polyline
            key={col}
            points={toPolylinePoints(template[col], plotW, gyroMin, gyroMax, gyroTop, PANEL_H)}
            fill="none"
            stroke={COLORS[i]}
            strokeWidth={1.5}
          />
        ))}

        {/* ── Acc panel ── */}
        <rect x={MARGIN.left} y={accTop} width={plotW} height={PANEL_H} fill="#fafafa" stroke="#ddd" />
        <text
          transform={`translate(11, ${accTop + PANEL_H / 2}) rotate(-90)`}
          textAnchor="middle" fontSize={9} fill="#aaa"
        >
          Accel (m/s²)
        </text>
        <YTicks x={MARGIN.left - 3} panelTop={accTop} panelH={PANEL_H} min={accMin} max={accMax} />
        {accCols.map((col, i) => (
          <polyline
            key={col}
            points={toPolylinePoints(template[col], plotW, accMin, accMax, accTop, PANEL_H)}
            fill="none"
            stroke={COLORS[i]}
            strokeWidth={1.5}
          />
        ))}

        {/* X-axis label */}
        <text x={CHART_W / 2} y={CHART_H - 2} textAnchor="middle" fontSize={9} fill="#aaa">
          Sample (0–99)
        </text>

        {/* Legend */}
        {["X", "Y", "Z"].map((label, i) => (
          <g key={label} transform={`translate(${MARGIN.left + plotW - 78 + i * 28}, ${gyroTop + 10})`}>
            <line x1={0} y1={0} x2={14} y2={0} stroke={COLORS[i]} strokeWidth={1.5} />
            <text x={17} y={4} fontSize={9} fill="#888">{label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
