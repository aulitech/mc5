import React from "react";
import { Link, Bluetooth, Settings } from "lucide-react";
import { useConfig } from "../../context/ConfigContext";
import { useDevice } from "../../context/DeviceContext";
import { useSettings } from "../../context/SettingsContext";
import JsonNodeRenderer from "../tree/JsonNodeRenderer";
import styles from "./GlobalTab.module.css";
import { HStack, VStack } from "../ui/Utility";

const LedIndicator = ({ count }) => (
  <HStack style={{ gap: "4px", position: "relative", top: "-1.4rem" }}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className={styles["led-dot"]} />
    ))}
  </HStack>
);

const GlobalTab = () => {
  const { data, setConfigValue, updateConfig } = useConfig();
  const { device } = useDevice();
  const { isAdvanced } = useSettings();
  if (!data) return null;

  const profiles = data.profiles;
  const globalInfo = data.global_info;

  const handleMapChange = (idx, value) => {
    const newMap = [...globalInfo.profile_map];
    newMap[idx] = parseInt(value);
    updateConfig(["global_info", "profile_map"], newMap);
  };

  const toggleSkip = (idx, isSkipped) => {
    const newMap = [...globalInfo.profile_map];
    if (isSkipped)
      newMap[idx] = -Math.abs(newMap[idx] + 1); // Set to negative to indicate skip
    else newMap[idx] = Math.abs(newMap[idx]) - 1; // Restore to valid profile index (default to 0 if it was -1)
    updateConfig(["global_info", "profile_map"], newMap);
  };
  return (
    <div
      style={{
        width: "90%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <HStack
        style={{
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "3rem",
          gap: "0.5rem",
        }}
      >
        <VStack style={{ alignItems: "flex-start", gap: "0.5rem" }}>
          <span>Name</span>
          <input
            className="input-base"
            maxLength={14}
            value={globalInfo.name || device?.productName.slice(0, -4)}
            onChange={(e) =>
              setConfigValue(
                ["global_info", "name"],
                e.target.value.replace(/[^a-zA-Z0-9_\- ']/g, ""),
              )
            }
            onBlur={(e) =>
              updateConfig(["global_info", "name"], e.target.value)
            }
          />
        </VStack>
        <span>ID: {globalInfo.HW_UID}</span>
      </HStack>

      {/* 2. PROFILE MAP (Advanced Only) */}
      {isAdvanced && (
        <>
          <div className={"section-title"}>Connections</div>
          <HStack
            style={{
              gap: "1rem",
              marginBottom: "2rem",
              justifyContent: "flex-start",
            }}
          >
            {[0, 1, 2].map((i) => {
              const isSkipped = globalInfo?.profile_map[i] < 0;
              return (
                <VStack
                  key={i}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: ".5rem",
                    gap: "1rem",
                    padding: "0.75rem",
                    backgroundColor: "var(--bg-card)",
                  }}
                >
                  <HStack
                    style={{
                      gap: "0.5rem",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <HStack
                      style={{
                        minWidth: "fit-content",
                        gap: "0.25rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <Bluetooth
                        size={16}
                        style={{
                          color: isSkipped
                            ? "var(--color-disabled)"
                            : "var(--led-blue)",
                        }}
                      />
                      <span style={{ fontSize: "large" }}>{i + 1}</span>
                    </HStack>
                    <LedIndicator count={i + 1} />
                    <HStack style={{ gap: "0.25rem", alignItems: "center" }}>
                      <span
                        style={{
                          fontSize: "smaller",
                          fontWeight: 500,
                        }}
                      >
                        Skip
                      </span>
                      <label className="toggle-switch">
                        <input
                          style={{ width: "1rem" }}
                          type="checkbox"
                          checked={isSkipped}
                          onChange={(e) => toggleSkip(i, e.target.checked)}
                        />
                      </label>
                    </HStack>
                  </HStack>
                  {!isSkipped && (
                    <>
                      <select
                        className="input-base"
                        value={isSkipped ? "" : globalInfo.profile_map[i]}
                        onChange={(e) => handleMapChange(i, e.target.value)}
                        disabled={isSkipped}
                        style={{ marginBottom: "0.75rem" }}
                      >
                        {isSkipped && <option value="">(Skipped)</option>}
                        {profiles.map((p, idx) => (
                          <option key={idx} value={idx}>
                            {p.name || `Profile ${idx}`}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </VStack>
              );
            })}
          </HStack>
        </>
      )}

      {/* 3. FLATTENED REMAINDER */}
      <div className={"section-title"}>
         Device Configuration
      </div>
      <JsonNodeRenderer
        name="Global Config"
        data={globalInfo}
        path={["global_info"]}
        isRootItem={true}
      />
    </div>
  );
};

export default GlobalTab;
