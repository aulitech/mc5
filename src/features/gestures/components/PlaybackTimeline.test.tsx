// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PlaybackTimeline from "./PlaybackTimeline";
import styles from "../GestureTab.module.css";

afterEach(cleanup);

const setup = (clock = 0) => {
  const onSeek = vi.fn();
  const onScrub = vi.fn();
  const { container } = render(
    <PlaybackTimeline length={250} sampleRate={100} clockRef={{ current: clock }} onSeek={onSeek} onScrub={onScrub} />,
  );
  return { container, onSeek, onScrub, playhead: screen.getByRole("slider", { name: "Playback position" }) };
};

describe("PlaybackTimeline", () => {
  it("ticks every 0.1 s, with 0.5 s and labelled 1 s ones", () => {
    const { container } = setup();
    expect(container.querySelectorAll(`.${styles.tick}`)).toHaveLength(26); // 0.0 … 2.5 s
    expect(container.querySelectorAll(`.${styles.tickMid}`)).toHaveLength(3); // 0.5, 1.5, 2.5
    expect(container.querySelectorAll(`.${styles.tickMajor}`)).toHaveLength(3); // 0, 1, 2
    expect([...container.querySelectorAll(`.${styles.tickLabel}`)].map((l) => l.textContent)).toEqual([
      "0 s",
      "1 s",
      "2 s",
    ]);
    expect(screen.getByRole("slider").getAttribute("aria-valuemax")).toBe("2500");
  });

  it("steps the clock with the keyboard, within the loop", () => {
    const { onSeek, playhead } = setup(245);
    fireEvent.keyDown(playhead, { key: "ArrowRight" });
    expect(onSeek).toHaveBeenLastCalledWith(250);
    fireEvent.keyDown(playhead, { key: "ArrowLeft" });
    expect(onSeek).toHaveBeenLastCalledWith(235);
    fireEvent.keyDown(playhead, { key: "PageDown" });
    expect(onSeek).toHaveBeenLastCalledWith(145);
    fireEvent.keyDown(playhead, { key: "Home" });
    expect(onSeek).toHaveBeenLastCalledWith(0);
  });
});
