import { useEffect, useRef, useState } from "react";
import ota from "../../device/ota";
import { useOtaEvent } from "../../device/useOtaEvent";
import { useConfig } from "../../context/ConfigContext";
import { useDevice } from "../../context/DeviceContext";
import { SLIDER_KEYS, clampToRange } from "../../lib/leafValue";
import { errorMessage, notify } from "../../lib/notify";
import type { Config, ConfigPath } from "../../types/config";
import type { GestureScore, PracticeInference } from "../../types/device";
import { getSchema } from "../../utils/schema";
import NumberSpinner from "../ui/NumberSpinner";
import PracticeInstructions from "../help/PracticeInstructions";
import { VStack, HStack, Text, Progress } from "../ui/Utility";

const findScore = (scores: GestureScore[] | undefined, label: string): GestureScore =>
  scores?.find((g) => g.label === label) ?? { label: "Unknown", confidence: 0, threshold: false };

const SENSITIVITY: ConfigPath = ["global_info", "gesture_sensitivity"];

// A gesture's confidence threshold (0–1), by its index in the gesture list.
const thresholdOf = (config: Config | null, index: number) => {
  const list = config?.global_info.gesture_sensitivity;
  const item = Array.isArray(list) ? (list[index] as { confidence_threshold?: unknown } | undefined) : undefined;
  return typeof item?.confidence_threshold === "number" ? item.confidence_threshold : null;
};

/**
 * A gesture's sensitivity setting (its confidence threshold, 0–1), with
 * `draft` to change it here only and `commit` to send it to Cato. Null for a
 * gesture without one to show: Idle and Movement, as in the config tree.
 */
function useThreshold(index: number) {
  const { data, setConfigValue, updateConfig } = useConfig();
  const { gestureNames } = useDevice();
  const value = thresholdOf(data, index);
  if (value === null || getSchema(SENSITIVITY, gestureNames)?.hiddenIndices?.includes(index)) return null;

  const path = [...SENSITIVITY, index, "confidence_threshold"];
  const schema = getSchema(path, gestureNames);
  const range = { min: schema?.min ?? 0.1, max: schema?.max ?? 1, step: schema?.step ?? 0.05 };
  return {
    value,
    range,
    draft: (n: number) => setConfigValue(path, clampToRange(n, range)),
    commit: (n: number) => updateConfig(path, clampToRange(n, range)),
  };
}

type Threshold = NonNullable<ReturnType<typeof useThreshold>>;

/**
 * The threshold laid over a gesture's confidence bar: the thumb marks the
 * confidence it fires at (the bar turns green past it). Drag left for more
 * sensitive. Sent to Cato when let go, like the Gesture Sensitivity sliders.
 */
function ThresholdSlider({ name, threshold }: { name: string; threshold: Threshold }) {
  const commit = (e: { currentTarget: HTMLInputElement }) => threshold.commit(parseFloat(e.currentTarget.value));
  const percent = Math.round(threshold.value * 100);
  return (
    // 0–1 across the whole track, so the thumb lines up with the bar's percent.
    <input
      type="range"
      className="threshold-slider"
      min={0}
      max={1}
      step={threshold.range.step}
      value={threshold.value}
      onChange={(e) => threshold.draft(parseFloat(e.target.value))}
      onPointerUp={commit}
      onKeyUp={(e) => SLIDER_KEYS.has(e.key) && commit(e)}
      aria-label={`${name} sensitivity`}
      aria-valuetext={`fires at ${percent}% confidence`}
      title={`${name} fires at ${percent}% confidence. Drag left to make it more sensitive, right for fewer false triggers.`}
    />
  );
}

/**
 * A gesture's confidence bar, with its threshold as a slider on the bar and
 * a number spinner just right of it. A gesture without a threshold keeps the
 * spinner's space, so the bars line up.
 */
function GestureBar({ index, name, score }: { index: number; name: string; score: GestureScore }) {
  const threshold = useThreshold(index);
  return (
    <Progress
      value={score.confidence}
      label={name}
      color={score.threshold ? "var(--success)" : score.confidence > 30 ? "var(--warning)" : "var(--danger)"}
      trackStyle={{ height: "1.125rem" }}
      after={
        <div style={{ width: "5.75rem", flex: "none" }}>
          {threshold && (
            <NumberSpinner
              value={threshold.value}
              range={threshold.range}
              label={`${name} confidence threshold`}
              onCommit={threshold.commit}
              width="4rem"
            />
          )}
        </div>
      }
    >
      {threshold && <ThresholdSlider name={name} threshold={threshold} />}
    </Progress>
  );
}

/**
 * Practice mode: the device streams live gesture confidences while the user
 * performs gestures. Stops on its own when a gesture fires, and when the tab
 * is left so the device isn't left in practice mode.
 */
function usePractice() {
  const [practicing, setPracticing] = useState(false);
  const [latest, setLatest] = useState<PracticeInference | null>(null);
  const [lastDetected, setLastDetected] = useState<PracticeInference | null>(null);
  const practicingRef = useRef(false);

  const setMode = async (on: boolean) => {
    practicingRef.current = on;
    setPracticing(on);
    try {
      await ota.send(`practice ${on ? "on" : "off"}`);
      console.log("Practice mode: ", on);
    } catch (err) {
      console.error("Failed to set practice mode:", err);
      notify.error(`Couldn't ${on ? "start" : "stop"} practice mode: ${errorMessage(err)}`);
    }
  };

  const start = () => {
    setLastDetected(null);
    setLatest(null);
    return setMode(true);
  };
  const stop = () => setMode(false);

  useOtaEvent("practice", (inference) => {
    if (!practicingRef.current) return;
    setLatest(inference);
    if (inference.trigger) {
      console.log("Triggered gesture during practice: ", inference.trigger);
      setLastDetected(inference);
      stop(); // a fired gesture ends the attempt
    }
  });

  useEffect(
    () => () => {
      if (practicingRef.current) ota.send("practice off").catch(() => {});
    },
    [],
  );

  return { practicing, latest, lastDetected, start, stop };
}

const PracticeTab = () => {
  const { gestureNames } = useDevice();
  const { practicing, latest, lastDetected, start, stop } = usePractice();

  return (
    <VStack
      style={{
        gap: "2rem",
        width: "100%",
        height: "100%",
        justifyContent: "flex-start",
        alignItems: "center",
      }}
    >
      <PracticeInstructions gestureNames={gestureNames} />
      <VStack
        style={{
          width: "100%",
          justifyContent: "center",
          alignItems: "center",
          gap: ".5rem",
        }}
      >
        <HStack style={{ marginBottom: "2rem", width: "100%" }}>
          <div style={{ flex: 1, marginRight: "1rem", justifyContent: "flex-end", display: "flex" }}>
            <button
              style={{ border: "1px solid var(--color-input)", borderRadius: "0.25rem", padding: "0.5rem 1rem" }}
              title="Start or Pause Practice Mode"
              onClick={practicing ? stop : start}
            >
              {practicing ? "Pause" : "Start"}
            </button>
          </div>
          <div style={{ flex: 1, marginLeft: "1rem", justifyContent: "flex-start", display: "flex" }}>
            <Text color="var(--color-input)">
              {lastDetected ? (
                <>
                  Detected:
                  <span style={{ paddingLeft: "1rem", fontSize: "x-large", fontWeight: "bolder" }}>
                    {lastDetected.trigger}
                  </span>
                </>
              ) : practicing ? (
                "Detecting gesture"
              ) : (
                "Press Start to begin"
              )}
            </Text>
          </div>
        </HStack>

        {practicing && (
          <VStack style={{ width: "60%", gap: "0.5rem" }}>
            {gestureNames.map((name, i) => (
              <GestureBar key={name} index={i} name={name} score={findScore(latest?.gestures, name)} />
            ))}
          </VStack>
        )}
      </VStack>
    </VStack>
  );
};

export default PracticeTab;
