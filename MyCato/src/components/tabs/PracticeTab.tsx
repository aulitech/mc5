import { useEffect, useRef, useState } from "react";
import ota from "../../device/ota";
import { useOtaEvent } from "../../device/useOtaEvent";
import { useDevice } from "../../context/DeviceContext";
import { errorMessage, notify } from "../../lib/notify";
import type { GestureScore, PracticeInference } from "../../types/device";
import PracticeInstructions from "../help/PracticeInstructions.jsx";
import { VStack, HStack, Text, Progress } from "../ui/Utility.jsx";

const findScore = (scores: GestureScore[] | undefined, label: string): GestureScore =>
  scores?.find((g) => g.label === label) ?? { label: "Unknown", confidence: 0, threshold: false };

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
          <VStack style={{ width: "60%", gap: "1rem" }}>
            {gestureNames.map((name) => {
              const score = findScore(latest?.gestures, name);
              return (
                <Progress
                  key={name}
                  value={score.confidence}
                  label={name}
                  color={score.threshold ? "green" : score.confidence > 30 ? "yellow" : "red"}
                />
              );
            })}
          </VStack>
        )}
      </VStack>
    </VStack>
  );
};

export default PracticeTab;
