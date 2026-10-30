// PlaybackTimeline.tsx — Time ruler along the bottom of a replaying pane.
//
// Ticks every 0.1 s (minor), 0.5 s (intermediate) and 1 s (major, labelled),
// across the pane's replay. The playhead follows the visualizer's shared
// replay clock and shows the time in ms; when comparing, the shorter replay's
// playhead waits at its end until the loop restarts. Dragging anywhere on the
// ruler, or using the arrow keys on the playhead, moves the clock for every
// pane; the replays hold still while it's dragged.
//
// The clock lives in a ref the animation loop advances every frame, so the
// playhead is moved by its own animation frame rather than by re-rendering.

import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import styles from "../GestureTab.module.css";

interface PlaybackTimelineProps {
  /** The replay's length, in samples. */
  length: number;
  sampleRate: number;
  /** The replay position, in samples. */
  clockRef: RefObject<number>;
  /** Move the replay to a position, in samples. */
  onSeek: (samples: number) => void;
  /** Dragging started (true) or ended (false). */
  onScrub: (active: boolean) => void;
}

const toMs = (samples: number, sampleRate: number) => Math.round((samples * 1000) / sampleRate);

const PlaybackTimeline = ({ length, sampleRate, clockRef, onSeek, onScrub }: PlaybackTimelineProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);

  // Follow the clock.
  useEffect(() => {
    let animId = 0;
    let shownMs = -1;
    const follow = () => {
      animId = requestAnimationFrame(follow);
      const clock = Math.min(Math.max(clockRef.current, 0), length);
      const ms = toMs(clock, sampleRate);
      if (ms === shownMs) return;
      shownMs = ms;
      headRef.current!.style.left = `${(clock / length) * 100}%`;
      headRef.current!.setAttribute("aria-valuenow", String(ms));
      headRef.current!.setAttribute("aria-valuetext", `${ms} ms`);
      readoutRef.current!.textContent = `${ms} ms`;
    };
    animId = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(animId);
  }, [clockRef, length, sampleRate]);

  const seekTo = (samples: number) => onSeek(Math.min(Math.max(samples, 0), length));

  const seekToPointer = (e: PointerEvent) => {
    const rect = trackRef.current!.getBoundingClientRect();
    seekTo(((e.clientX - rect.left) / rect.width) * length);
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation(); // a drag here isn't a click on the pane (Compare's targeting)
    e.currentTarget.setPointerCapture(e.pointerId);
    headRef.current!.focus();
    onScrub(true);
    seekToPointer(e);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) seekToPointer(e);
  };

  const handlePointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    onScrub(false);
  };

  const tenth = sampleRate / 10;
  const handleKeyDown = (e: KeyboardEvent) => {
    const step = { ArrowLeft: -tenth, ArrowDown: -tenth, ArrowRight: tenth, ArrowUp: tenth, PageDown: -sampleRate, PageUp: sampleRate }[e.key];
    if (step !== undefined) seekTo(clockRef.current + step);
    else if (e.key === "Home") seekTo(0);
    else if (e.key === "End") seekTo(length);
    else return;
    e.preventDefault();
  };

  // One tick per 0.1 s, counted in tenths so the 0.5 s and 1 s ones fall on whole numbers.
  const tenths = Math.floor((length * 10) / sampleRate + 1e-6);
  const ticks = Array.from({ length: tenths + 1 }, (_, k) => k);

  return (
    <div
      className={styles.timeline}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <div ref={trackRef} className={styles.timelineTrack}>
        {ticks.map((k) => {
          const kind = k % 10 === 0 ? styles.tickMajor : k % 5 === 0 ? styles.tickMid : styles.tickMinor;
          const left = `${((k * tenth) / length) * 100}%`;
          return (
            <span key={k}>
              <span className={`${styles.tick} ${kind}`} style={{ left }} />
              {k % 10 === 0 && (
                <span className={styles.tickLabel} style={{ left }}>
                  {k / 10} s
                </span>
              )}
            </span>
          );
        })}
        <div
          ref={headRef}
          className={styles.playhead}
          role="slider"
          tabIndex={0}
          aria-label="Playback position"
          aria-valuemin={0}
          aria-valuemax={toMs(length, sampleRate)}
          onKeyDown={handleKeyDown}
        >
          <span ref={readoutRef} className={styles.playheadTime} />
        </div>
      </div>
    </div>
  );
};

export default PlaybackTimeline;
