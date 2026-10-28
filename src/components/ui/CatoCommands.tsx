import { useState, useRef, useEffect } from "react";
import { useConfig } from "../../context/ConfigContext";
import { useDevice } from "../../context/DeviceContext";
import ota from "../../device/ota";
import { openConfigFile, saveConfigFile } from "../../lib/configFile";
import { errorMessage, notify } from "../../lib/notify";
import ConfirmModal from "../modals/ConfirmModal";

interface MenuItem {
  label: string;
  /** Shown in the confirmation dialog. */
  prompt: string;
  run: () => Promise<unknown>;
}

const CatoCommands = ({ onCheckForUpdates }: { onCheckForUpdates: () => Promise<void> }) => {
  const { data, replaceConfig } = useConfig();
  const { disconnect } = useDevice();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [pending, setPending] = useState<MenuItem | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const deviceCommand = (command: string) => () => ota.send(command);

  const menuItems: MenuItem[] = [
    {
      label: "Backup",
      run: async () => {
        if (data) await saveConfigFile(data);
      },
      prompt:
        "This will create a backup of Cato's current configuration on your system in a folder of your choice. Do you want to continue?",
    },
    {
      label: "Restore",
      run: async () => {
        const restored = await openConfigFile();
        if (restored !== null) await replaceConfig(restored);
      },
      prompt:
        "Restoring a configuration will overwrite all your current settings. After restoration you must save the configuration. Do you want to continue?",
    },
    {
      label: "Check for Updates",
      run: onCheckForUpdates,
      prompt:
        "This will check for the latest firmware version. If an update is available, you will be prompted to select and install it.",
    },
    {
      label: "Reset",
      run: deviceCommand("reboot"),
      prompt:
        "Are you sure you want to reset? Any unsaved settings will be lost. Cato will disconnect and you will need to reconnect after rebooting.",
    },
    {
      label: "Upgrade",
      run: deviceCommand("reboot uf2"),
      prompt:
        'This upgrade command is only for use with custom firmware. Most users should "Check for Updates" instead. It will reboot Cato into upgrade mode, allowing you to flash new firmware via USB by dragging and dropping a .uf2 file onto the Cato drive using your file manager. Are you sure you want to reboot into upgrade mode?',
    },
    {
      label: "Factory Reset",
      run: deviceCommand("factory_reset"),
      prompt:
        "Are you sure you want to factory reset? This will erase all your settings and bluetooth connections, and reboot the device into upgrade mode. Cato will disconnect and you will need to pair before reconnecting.",
    },
  ];

  const onConfirm = async () => {
    const item = pending;
    setPending(null);
    if (!item) return;
    try {
      await item.run();
    } catch (err) {
      if (!errorMessage(err).toLowerCase().includes("notallowederror")) {
        console.error(`Error running ${item.label}:`, err);
        notify.error(`${item.label} failed: ${errorMessage(err)}`);
      }
    }
  };

  const choose = (item: MenuItem) => {
    setPending(item);
    setIsMenuOpen(false);
  };

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsMenuOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isMenuOpen]);

  return (
    <>
      <ConfirmModal isOpen={pending !== null} onClose={() => setPending(null)} onConfirm={onConfirm}>
        <p>{pending?.prompt}</p>
      </ConfirmModal>
      <button onClick={disconnect}>Disconnect</button>
      <div style={{ position: "relative" }} ref={menuRef}>
        <button aria-haspopup="menu" aria-expanded={isMenuOpen} onClick={() => setIsMenuOpen((prev) => !prev)}>
          Manage
        </button>
        {isMenuOpen && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              right: 0,
              backgroundColor: "var(--bg-card)",
              color: "var(--color-card)",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              zIndex: 10,
              boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
            }}
          >
            <ul role="menu" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {menuItems.map((item, i) => (
                <li key={item.label} role="none">
                  <button
                    role="menuitem"
                    className="btn-ghost"
                    autoFocus={i === 0}
                    onClick={() => choose(item)}
                    style={{
                      marginBottom: "0.1rem",
                      width: "100%",
                      padding: "0.5rem 1rem",
                      cursor: "pointer",
                      justifyContent: "flex-start",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
};
export default CatoCommands;
