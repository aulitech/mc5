import { useState, useRef, type KeyboardEvent, type PointerEvent } from "react";
import styles from "./PointerCurveGraph.module.css";

// Graph Constants
const PADDING = 40;
const WIDTH = 500;
const HEIGHT = 300;

// Keyboard nudges for a focused handle (Shift for bigger steps).
const KEY_STEP_X = 1;
const KEY_STEP_Y = 0.1;
const KEY_SHIFT_FACTOR = 5;

export interface Acceleration {
  start: number;
  stop: number;
  scale_slow: number;
  scale_fast: number;
}

type Range = { min?: number; max?: number };
export type AccelerationLimits = Partial<Record<keyof Acceleration, Range>>;

type Handle = "p1" | "p2";

interface PointerCurveGraphProps {
  data: Acceleration;
  limits: AccelerationLimits | null;
  /** Every change while dragging or nudging (local only). */
  onChange: (next: Acceleration) => void;
  /** The final value once the handle is released. */
  onSave: (next: Acceleration) => void;
  title?: string;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const PointerCurveGraph = ({ data, limits, onChange, onSave, title }: PointerCurveGraphProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<Handle | null>(null);
  // The last value produced by this drag/nudge, sent on release.
  const [lastModified, setLastModified] = useState<Acceleration | null>(null);

  const { start, stop, scale_slow, scale_fast } = data;

  const lim = {
    start: { min: limits?.start?.min ?? 0, max: limits?.start?.max ?? 100 },
    stop: { min: limits?.stop?.min ?? 0, max: limits?.stop?.max ?? 100 },
    slow: { min: limits?.scale_slow?.min ?? 0.1, max: limits?.scale_slow?.max ?? 5.0 },
    fast: { min: limits?.scale_fast?.min ?? 0.1, max: limits?.scale_fast?.max ?? 5.0 },
  };
  // Axes span the furthest a handle can go, so no handle is ever drawn off-graph.
  const graphMaxX = Math.max(lim.start.max, lim.stop.max);
  const graphMaxY = Math.max(lim.slow.max, lim.fast.max);

  // --- COORDINATE TRANSFORMERS ---
  const valToX = (val: number) => PADDING + (val / graphMaxX) * (WIDTH - PADDING * 2);
  const valToY = (val: number) => HEIGHT - PADDING - (val / graphMaxY) * (HEIGHT - PADDING * 2);
  const xToVal = (x: number) => ((x - PADDING) / (WIDTH - PADDING * 2)) * graphMaxX;
  const yToVal = (y: number) => ((HEIGHT - PADDING - y) / (HEIGHT - PADDING * 2)) * graphMaxY;

  const p1 = { x: valToX(start), y: valToY(scale_slow) };
  const p2 = { x: valToX(stop), y: valToY(scale_fast) };

  const updateData = (modifications: Partial<Acceleration>) => {
    const next = { ...data, ...modifications };
    next.start = clamp(next.start, lim.start.min, lim.start.max);
    next.stop = clamp(next.stop, lim.stop.min, lim.stop.max);
    next.scale_slow = Number(clamp(next.scale_slow, lim.slow.min, lim.slow.max).toFixed(2));
    next.scale_fast = Number(clamp(next.scale_fast, lim.fast.min, lim.fast.max).toFixed(2));
    setLastModified(next);
    onChange(next);
  };

  // Move a handle to (x, y) in value units. The slow point (p1) stays
  // left of / below the fast point (p2), and vice versa.
  const moveHandle = (handle: Handle, x: number, y: number) => {
    if (handle === "p1") {
      updateData({ start: Math.min(Math.round(x), stop), scale_slow: Math.min(y, scale_fast) });
    } else {
      updateData({ stop: Math.max(Math.round(x), start), scale_fast: Math.max(y, scale_slow) });
    }
  };

  const release = () => {
    if (lastModified) onSave(lastModified);
    setLastModified(null);
  };

  // --- DRAG LOGIC ---
  const handlePointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    // Scaling factor in case SVG is resized via CSS
    const svgX = (e.clientX - rect.left) * (WIDTH / rect.width);
    const svgY = (e.clientY - rect.top) * (HEIGHT / rect.height);
    moveHandle(dragging, xToVal(svgX), Number(yToVal(svgY).toFixed(2)));
  };

  const handlePointerDown = (handle: Handle) => (e: PointerEvent<SVGCircleElement>) => {
    e.preventDefault();
    setDragging(handle);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerUp = (e: PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    setDragging(null);
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    release();
  };

  // --- KEYBOARD ---
  const handleKeyDown = (handle: Handle) => (e: KeyboardEvent<SVGCircleElement>) => {
    const factor = e.shiftKey ? KEY_SHIFT_FACTOR : 1;
    const [x, y] = handle === "p1" ? [start, scale_slow] : [stop, scale_fast];
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP_X, 0],
      ArrowRight: [KEY_STEP_X, 0],
      ArrowUp: [0, KEY_STEP_Y],
      ArrowDown: [0, -KEY_STEP_Y],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    moveHandle(handle, x + move[0] * factor, y + move[1] * factor);
  };

  const xc = 0.25 * (p2.x - p1.x);
  const accPath = `
        M ${valToX(0)} ${p1.y}
        H ${p1.x}
        C ${p1.x + xc} ${p1.y},${p2.x - xc} ${p2.y}, ${p2.x} ${p2.y}
        H ${valToX(graphMaxX)}
    `;

  const handleProps = (handle: Handle, label: string, x: number, y: number) => ({
    r: 12,
    className: styles["graph-handle"],
    tabIndex: 0,
    role: "slider",
    "aria-label": `${label} point`,
    "aria-valuetext": `speed ${x}, multiplier ${y}`,
    onPointerDown: handlePointerDown(handle),
    onKeyDown: handleKeyDown(handle),
    onKeyUp: release,
    onBlur: release,
  });

  return (
    <div className={styles["graph-container"]}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="group"
        aria-label="Pointer acceleration curve. Focus a point and use the arrow keys to move it."
        style={{
          width: "100%",
          height: "100%",
          overflow: "visible",
          touchAction: "none",
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {title && (
          <text x={WIDTH / 2} y={20} className={styles["graph-internal-title"]} textAnchor="middle">
            {title}
          </text>
        )}
        {/* Axes */}
        <path
          d={`M ${PADDING} ${PADDING} V ${HEIGHT - PADDING} H ${WIDTH - PADDING}`}
          className={styles["graph-grid-line"]}
        />
        {/* Axis Titles */}
        <text
          x={WIDTH - PADDING}
          y={HEIGHT - PADDING - 10}
          className={styles["graph-axis-title"]}
          textAnchor="end"
        >
          Speed of Movement(deg/s)
        </text>
        <text x={PADDING} y={PADDING} className={styles["graph-axis-title"]} textAnchor="start">
          Multiplier
        </text>
        {/* Curve */}
        <path d={accPath} className={styles["graph-curve"]} />
        {/* Handles */}
        <circle cx={p1.x} cy={p1.y} {...handleProps("p1", "Slow", start, scale_slow)} />
        <circle cx={p2.x} cy={p2.y} {...handleProps("p2", "Fast", stop, scale_fast)} />
        {/* Visual Labels */}
        <text x={p1.x} y={HEIGHT - PADDING + 20} className={styles["graph-label-text"]} textAnchor="middle">
          <tspan x={p1.x} fill="var(--color-input)">
            {start}
          </tspan>
          <tspan x={p1.x} dy="1rem" fill="var(--color)">
            start
          </tspan>
        </text>
        <text x={p2.x} y={HEIGHT - PADDING + 20} className={styles["graph-label-text"]} textAnchor="middle">
          <tspan x={p2.x} fill="var(--color-input)">
            {stop}
          </tspan>
          <tspan fill="var(--color)" x={p2.x} dy="1rem">
            stop
          </tspan>
        </text>
        <text x={PADDING - 10} y={p1.y + 4} className={styles["graph-label-text"]} textAnchor="end">
          <tspan fill="var(--color-input)">{scale_slow}</tspan>
          <tspan fill="var(--color)" x={PADDING - 10} dy="1rem">
            slow
          </tspan>
        </text>
        <text x={PADDING - 10} y={p2.y + 4} className={styles["graph-label-text"]} textAnchor="end">
          <tspan fill="var(--color-input)">{scale_fast}</tspan>
          <tspan fill="var(--color)" x={PADDING - 10} dy="1rem">
            fast
          </tspan>
        </text>
      </svg>
    </div>
  );
};
