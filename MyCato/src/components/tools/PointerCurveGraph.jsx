import React, { useState, useRef } from "react";

// Graph Constants
const PADDING = 40;
const GRAPH_MAX_X = 60;
const GRAPH_MAX_Y = 5.0;
const WIDTH = 500;
const HEIGHT = 300;

import styles from "./PointerCurveGraph.module.css";

export const PointerCurveGraph = ({
  data,
  limits,
  onChange,
  onSave,
  title,
}) => {
  const svgRef = useRef(null);
  const [dragging, setDragging] = useState(null);

  const { start, stop, scale_slow, scale_fast } = data;

  // --- COORDINATE TRANSFORMERS ---
  const valToX = (val) => PADDING + (val / GRAPH_MAX_X) * (WIDTH - PADDING * 2);
  const valToY = (val) =>
    HEIGHT - PADDING - (val / GRAPH_MAX_Y) * (HEIGHT - PADDING * 2);

  const xToVal = (x) => ((x - PADDING) / (WIDTH - PADDING * 2)) * GRAPH_MAX_X;
  const yToVal = (y) =>
    ((HEIGHT - PADDING - y) / (HEIGHT - PADDING * 2)) * GRAPH_MAX_Y;

  // Calculate SVG Points
  const p1 = { x: valToX(start), y: valToY(scale_slow) };
  const p2 = { x: valToX(stop), y: valToY(scale_fast) };

  // The last modified data point
  const [lastModified, setLastModified] = useState(null);

  // --- DRAG LOGIC ---
  const updateData = (modifications) => {
    const next = { ...data, ...modifications };

    // 1. Get Limits
    const lim = {
      start: {
        min: limits?.start?.min ?? 0,
        max: limits?.start?.max ?? 100,
      },
      stop: {
        min: limits?.stop?.min ?? 0,
        max: limits?.stop?.max ?? 100,
      },
      slow: {
        min: limits?.scale_slow?.min ?? 0.1,
        max: limits?.scale_slow?.max ?? 5.0,
      },
      fast: {
        min: limits?.scale_fast?.min ?? 0.1,
        max: limits?.scale_fast?.max ?? 5.0,
      },
    };

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    // 2. Hard Limits
    next.start = clamp(next.start, lim.start.min, lim.start.max);
    next.stop = clamp(next.stop, lim.stop.min, lim.stop.max);
    next.scale_slow = Number(
      clamp(next.scale_slow, lim.slow.min, lim.slow.max).toFixed(2),
    );
    next.scale_fast = Number(
      clamp(next.scale_fast, lim.fast.min, lim.fast.max).toFixed(2),
    );
    setLastModified(next);
    //console.log("Updating Pointer Data:", next);
    onChange(next);
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    const rect = svgRef.current.getBoundingClientRect();
    // Scaling factor in case SVG is resized via CSS
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;

    const svgX = (e.clientX - rect.left) * scaleX;
    const svgY = (e.clientY - rect.top) * scaleY;

    let rawX = Math.round(xToVal(svgX));
    let rawY = Number(yToVal(svgY).toFixed(2));

    if (dragging === "p1") {
      if (rawX > stop) rawX = stop;
      if (rawY > scale_fast) rawY = scale_fast;
      updateData({ start: rawX, scale_slow: rawY });
    } else if (dragging === "p2") {
      if (rawX < start) rawX = start;
      if (rawY < scale_slow) rawY = scale_slow;
      updateData({ stop: rawX, scale_fast: rawY });
    }
  };

  const handlePointerDown = (point) => (e) => {
    e.preventDefault();
    setDragging(point);
    e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerUp = (e) => {
    setDragging(null);
    e.target.releasePointerCapture(e.pointerId);
    if (lastModified) onSave(lastModified);
    setLastModified(null);
  };

  const xc = 0.25 * (p2.x - p1.x);
  const accPath = `
        M ${valToX(0)} ${p1.y}
        H ${p1.x}
        C ${p1.x + xc} ${p1.y},${p2.x - xc} ${p2.y}, ${p2.x} ${p2.y}
        H ${valToX(GRAPH_MAX_X)}
    `;


  return (
    <div className={styles["graph-container"]}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{
          width: "100%",
          height: "100%",
          overflow: "visible",
          touchAction: "none",
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* INTERNAL TITLE - CENTERED */}
        {title && (
          <text
            x={WIDTH / 2}
            y={20}
            className={styles["graph-internal-title"]}
            textAnchor="middle"
          >
            {title}
          </text>
        )}
        {/* Axes */}
        <path
          d={`
            M ${PADDING} ${PADDING} V ${HEIGHT - PADDING} H ${WIDTH - PADDING}
          `}
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
        {/* Moved Y-axis title down slightly (y=32) to clear the main title area */}
        <text
          x={PADDING}
          y={PADDING}
          className={styles["graph-axis-title"]}
          textAnchor="start"
        >
          Multiplier
        </text>
        {/* Curve */}
        <path d={accPath} className={styles["graph-curve"]} />
        {/* Drop Lines
        <path
          d={`M ${p1.x} ${p1.y} v ${p1.y}
          M ${p2.x} ${p2.y} v ${p2.y}`}

          className={styles["graph-drop-line"]}
        />*/}
        k{/* Handles */}
        <circle
          cx={p1.x}
          cy={p1.y}
          r="12"
          className={styles["graph-handle"]}
          onPointerDown={handlePointerDown("p1")}
        />
        <circle
          cx={p2.x}
          cy={p2.y}
          r="12"
          className={styles["graph-handle"]}
          onPointerDown={handlePointerDown("p2")}
        />
        {/* Visual Labels */}
        <text
          x={p1.x}
          y={HEIGHT - PADDING + 20}
          className={styles["graph-label-text"]}
          textAnchor="middle"
        >
          <tspan x={p1.x} fill="var(--color-input)">{start}</tspan>
          <tspan x={p1.x} dy="1rem" fill="var(--color)">
            start
          </tspan>
        </text>
        <text
          x={p2.x}
          y={HEIGHT - PADDING + 20}
          className={styles["graph-label-text"]}
          textAnchor="middle"
        >
          <tspan x={p2.x} fill="var(--color-input)">
            {stop}
          </tspan>
          <tspan fill="var(--color)" x={p2.x} dy="1rem">
            stop
          </tspan>
        </text>
        <text
          x={PADDING - 10}
          y={p1.y + 4}
          className={styles["graph-label-text"]}
          textAnchor="end"
        >
          <tspan fill="var(--color-input)">{scale_slow}</tspan>
          <tspan fill="var(--color)" x={PADDING - 10} dy="1rem">
            slow
          </tspan>
        </text>
        <text
          x={PADDING - 10}
          y={p2.y + 4}
          className={styles["graph-label-text"]}
          textAnchor="end"
        >
          <tspan fill="var(--color-input)">{scale_fast}</tspan>
          <tspan fill="var(--color)" x={PADDING - 10} dy="1rem">
            fast
          </tspan>
        </text>
      </svg>
    </div>
  );
};
