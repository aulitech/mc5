// GestureTemplateChart.tsx — SVG chart showing a gesture template's 6 channels.
//
// Renders two panels stacked vertically:
//   Top panel:    Gyroscope (X, Y, Z)
//   Bottom panel: Accelerometer (X, Y, Z)
//
// Each panel shows 100 time-samples (the template output from buildTemplate).
// Pure SVG — no canvas, no external chart library needed.
//
// Ported from expense-tracker/mvp/components/GestureTemplateChart.js; colours
// now follow the app theme.

import type { Template, TemplateChannel } from "../../../types/gestures";

const MARGIN = { left: 48, right: 15, top: 10, bottom: 30 };
const PANEL_H = 90;
const GAP = 18;
const CHART_W = 380;
const CHART_H = MARGIN.top + PANEL_H + GAP + PANEL_H + MARGIN.bottom;

// X, Y, Z — blue / orange / reddish purple from the Okabe–Ito palette, which
// stays distinguishable with the common forms of colour blindness (unlike
// red/green). Shaded per theme in index.css (--chart-1..3) to keep 3:1
// against the panel.
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];
const PANEL_FILL = "var(--bg-input)";
const PANEL_STROKE = "var(--border)";
const TEXT_FILL = "var(--color-card)";

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
        <text key={val} x={x} y={y} textAnchor="end" fontSize={8} fill={TEXT_FILL}>
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
      <svg
        width={CHART_W}
        height={CHART_H}
        style={{ fontFamily: "sans-serif", display: "block" }}
        role="img"
        aria-label={`Template for ${gestureName}: gyroscope and accelerometer X, Y and Z over ${template.acc_x?.length ?? 0} samples`}
      >
        {/* ── Gyro panel ── */}
        <rect x={MARGIN.left} y={gyroTop} width={plotW} height={PANEL_H} fill={PANEL_FILL} stroke={PANEL_STROKE} />
        <text
          transform={`translate(11, ${gyroTop + PANEL_H / 2}) rotate(-90)`}
          textAnchor="middle" fontSize={9} fill={TEXT_FILL}
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
        <rect x={MARGIN.left} y={accTop} width={plotW} height={PANEL_H} fill={PANEL_FILL} stroke={PANEL_STROKE} />
        <text
          transform={`translate(11, ${accTop + PANEL_H / 2}) rotate(-90)`}
          textAnchor="middle" fontSize={9} fill={TEXT_FILL}
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
        <text x={CHART_W / 2} y={CHART_H - 2} textAnchor="middle" fontSize={9} fill={TEXT_FILL}>
          Sample (0–99)
        </text>

        {/* Legend */}
        {["X", "Y", "Z"].map((label, i) => (
          <g key={label} transform={`translate(${MARGIN.left + plotW - 78 + i * 28}, ${gyroTop + 10})`}>
            <line x1={0} y1={0} x2={14} y2={0} stroke={COLORS[i]} strokeWidth={1.5} />
            <text x={17} y={4} fontSize={9} fill={TEXT_FILL}>{label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
