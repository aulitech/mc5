import { lazy, Suspense, useState, type ComponentType } from "react";
import { Sun, Moon, SunMoon } from "lucide-react";

// Context
import { useConfig } from "../../context/ConfigContext";
import { useDevice } from "../../context/DeviceContext";
import { useSettings, type Theme } from "../../context/SettingsContext";
import { useOtaEvent } from "../../device/useOtaEvent";
import { fetchLatestReleases, isInstalled, type Release } from "../../lib/releases";
import { errorMessage, notify } from "../../lib/notify";

// Tabs
import GlobalTab from "../tabs/GlobalTab";
import TestsTab from "../tabs/TestsTab";
import ActionManagerTab from "../tabs/ActionManagerTab";
import ProfileManagerTab from "../tabs/ProfileManagerTab";
import PracticeTab from "../tabs/PracticeTab";
import MainInstructions from "../help/MainInstructions";
import NoHID from "../help/NoHID";
import CatoCommands from "./CatoCommands";
import HoverClickButton from "./HoverClickButton";
import { HStack, VStack, Ring } from "./Utility";
import Update from "./Update";
import Logo from "./Logo";

// Experimental, and the only user of three.js — loaded on first open.
const GestureTab = lazy(() => import("../../features/gestures/GestureTab"));

interface TabDef {
  id: string;
  component: ComponentType;
  /** Only shown with Advanced + Experimental switched on. */
  experimental?: boolean;
}

const TABS: TabDef[] = [
  { id: "General", component: GlobalTab },
  { id: "Profile", component: ProfileManagerTab },
  { id: "Action", component: ActionManagerTab },
  { id: "Practice", component: PracticeTab },
  { id: "Tools", component: TestsTab },
  { id: "Gestures", component: GestureTab, experimental: true },
];

// Each theme button shows the theme it switches to next.
const THEME_CYCLE: Record<Theme, { next: Theme; Icon: typeof Sun; title: string }> = {
  os: { next: "light", Icon: Sun, title: "Light Theme" },
  light: { next: "dark", Icon: Moon, title: "Dark Theme" },
  dark: { next: "os", Icon: SunMoon, title: "System Theme" },
};

const isBrowserSupported = "hid" in navigator && "showOpenFilePicker" in window;

const Shell = () => {
  const { device, status, isConnecting, connect } = useDevice();
  const { data, saveConfig } = useConfig();
  const { theme, setTheme, isAdvanced, setIsAdvanced, showExperimental, setShowExperimental } =
    useSettings();
  const [activeTab, setActiveTab] = useState("General");
  // The release on offer while the update screen is open.
  const [update, setUpdate] = useState<Release | null>(null);

  useOtaEvent("disconnect", () => setActiveTab("General"));

  const checkForUpdates = async () => {
    try {
      const [latest] = await fetchLatestReleases();
      const installedVersion = device?.info.version?.string;
      if (!latest) notify.info("No firmware releases found.");
      else if (isInstalled(latest, installedVersion)) notify.success(`Cato is up to date (${installedVersion}).`);
      else setUpdate(latest);
    } catch (err) {
      console.error("Error fetching releases:", err);
      notify.error(`Couldn't check for updates: ${errorMessage(err)}`);
    }
  };

  const visibleTabs = TABS.filter((t) => !t.experimental || (isAdvanced && showExperimental));
  const currentTab = visibleTabs.find((t) => t.id === activeTab) ?? visibleTabs[0];
  const ActiveTab = currentTab.component;
  const themeButton = THEME_CYCLE[theme];

  return (
    <VStack
      style={{
        height: "100vh",
        width: "100vw",
        justifyContent: "flex-start",
        overflow: "hidden",
        backgroundColor: "var(--bg)",
        color: "var(--color)",
      }}
    >
      {/* HEADER */}
      <HStack
        style={{
          padding: "1rem",
          width: "100%",
          justifyContent: "space-between",
          backgroundColor: "var(--bg-header)",
          color: "var(--color-header)",
        }}
      >
        <Logo data={data} device={device} catoStatus={status} />
        <HStack style={{ gap: "1rem" }}>
          {device ? (
            <CatoCommands onCheckForUpdates={checkForUpdates} />
          ) : isBrowserSupported && !data ? (
            <button onClick={connect}>Connect</button>
          ) : null}
        </HStack>
        <HStack style={{ flex: "1", justifyContent: "flex-end", gap: "1rem" }}>
          <button onClick={() => setTheme(themeButton.next)} title={themeButton.title}>
            <themeButton.Icon size={18} />
          </button>
        </HStack>
      </HStack>

      {/* BROWSER FEATURE & LOADING WARNING */}
      {!isBrowserSupported ? (
        <NoHID />
      ) : isConnecting || (device && !data) ? (
        <VStack
          style={{
            gap: "1rem",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <h3>Select a device to connect from the pop-up.</h3>
          <p />
          <p>After selecting, the configuration will load in a few seconds.</p>
          <p />
          <div>
            <Ring color="var(--led-blue)" />
          </div>
        </VStack>
      ) : update ? (
        <Update release={update} onClose={() => setUpdate(null)} />
      ) : !data ? (
        <MainInstructions onConnect={connect} />
      ) : (
        <>
          <HStack
            style={{
              width: "100%",
              padding: ".25rem 1rem 0 1rem",
              justifyContent: "space-between",
              alignItems: "flex-end",
              backgroundColor: "var(--bg-toolbar)",
              color: "var(--color-toolbar)",
              border: "none",
            }}
          >
            {/* TAB SELECTION  */}
            <HStack style={{ gap: 0, flexWrap: "wrap", alignItems: "flex-end" }}>
              {visibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`tab ${currentTab.id === tab.id ? "active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.id}
                </button>
              ))}
            </HStack>
            {/* ACTIONS*/}
            <HStack style={{ gap: ".25rem" }}>
              <HoverClickButton
                command="dwell_click"
                label="DC"
                title="Toggle Dwell Click"
                active={status?.dwellClick}
              />
              {status?.unsavedChanges && (
                <button className="indicator active" onClick={saveConfig} title="Save Changes">
                  Save
                </button>
              )}
              <HoverClickButton command="sleep" label="Sleep" title="Sleep" />
            </HStack>

            {/* ADVANCED MODE SWITCH */}
            <VStack>
              <HStack className="toggle-switch" style={{ paddingBottom: ".25rem" }}>
                <span style={{ fontSize: isAdvanced ? "x-small" : "smaller" }}>Advanced</span>
                <input
                  style={{ width: "1rem" }}
                  type="checkbox"
                  aria-label="Advanced"
                  checked={isAdvanced}
                  onChange={(e) => setIsAdvanced(e.target.checked)}
                />
              </HStack>
              {isAdvanced && (
                <HStack className="toggle-switch" style={{ paddingBottom: ".25rem" }}>
                  <span style={{ fontSize: "x-small" }}>Experimental</span>
                  <input
                    style={{ width: "1rem" }}
                    type="checkbox"
                    aria-label="Experimental"
                    checked={showExperimental}
                    onChange={(e) => setShowExperimental(e.target.checked)}
                  />
                </HStack>
              )}
            </VStack>
          </HStack>

          {/* MAIN CONTENT */}
          <VStack
            style={{
              margin: "0 1rem",
              padding: "1rem",
              backgroundColor: "var(--bg-card)",
              borderRadius: 0,
              border: "none",
              width: "100%",
              height: "100vh",
              overflowY: "auto",
              justifyContent: "flex-start",
              alignItems: "center",
            }}
          >
            <Suspense fallback={<Ring color="var(--led-blue)" />}>
              <ActiveTab />
            </Suspense>
          </VStack>
        </>
      )}
    </VStack>
  );
};

export default Shell;
