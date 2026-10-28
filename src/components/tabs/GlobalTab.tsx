import { Bluetooth } from "lucide-react";
import { useConfig } from "../../context/ConfigContext";
import { useDevice } from "../../context/DeviceContext";
import { useSettings } from "../../context/SettingsContext";
import JsonNodeRenderer from "../tree/JsonNodeRenderer";
import styles from "./GlobalTab.module.css";
import { HStack, VStack } from "../ui/Utility";

const LedIndicator = ({ count }: { count: number }) => (
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

  const handleMapChange = (idx: number, value: string) => {
    const newMap = [...globalInfo.profile_map];
    newMap[idx] = parseInt(value, 10);
    updateConfig(["global_info", "profile_map"], newMap);
  };

  // A skipped connection is stored as -(profile + 1), so un-skipping restores it.
  const toggleSkip = (idx: number, isSkipped: boolean) => {
    const newMap = [...globalInfo.profile_map];
    newMap[idx] = isSkipped ? -(newMap[idx] + 1) : -newMap[idx] - 1;
    updateConfig(["global_info", "profile_map"], newMap);
  };

  const sanitizeName = (name: string) => name.replace(/[^a-zA-Z0-9_\- ']/g, "");
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
          <label htmlFor="device-name">Name</label>
          <input
            id="device-name"
            className="input-base"
            maxLength={14}
            value={globalInfo.name || device?.productName.slice(0, -4) || ""}
            onChange={(e) => setConfigValue(["global_info", "name"], sanitizeName(e.target.value))}
            onBlur={(e) => updateConfig(["global_info", "name"], sanitizeName(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
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
              const isSkipped = globalInfo.profile_map[i] < 0;
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
                          aria-label={`Skip connection ${i + 1}`}
                          checked={isSkipped}
                          onChange={(e) => toggleSkip(i, e.target.checked)}
                        />
                      </label>
                    </HStack>
                  </HStack>
                  {!isSkipped && (
                    <select
                      className="input-base"
                      aria-label={`Profile for connection ${i + 1}`}
                      value={globalInfo.profile_map[i]}
                      onChange={(e) => handleMapChange(i, e.target.value)}
                      style={{ marginBottom: "0.75rem" }}
                    >
                      {profiles.map((p, idx) => (
                        <option key={idx} value={idx}>
                          {p.name || `Profile ${idx}`}
                        </option>
                      ))}
                    </select>
                  )}
                </VStack>
              );
            })}
          </HStack>
        </>
      )}

      {/* 3. FLATTENED REMAINDER */}
      <div className={"section-title"}>Device Configuration</div>
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
