import { useState, useRef, useEffect } from "react";
import { useConfig } from "../../context/ConfigContext";
import { useDevice } from "../../context/DeviceContext";
import ota from "../../device/ota";
import { openConfigFile, saveConfigFile } from "../../lib/configFile";
import { errorMessage, notify } from "../../lib/notify";
import ConfirmModal from "../modals/ConfirmModal";

const CatoCommands = ({ onCheckForUpdates }) => {
  const { data, replaceConfig } = useConfig();
  const { disconnect } = useDevice();

  const backupConfig = () => saveConfigFile(data);
  const restoreConfig = async () => {
    const restored = await openConfigFile();
    if (restored) await replaceConfig(restored);
  };
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    command: null,
    label: "",
  });

  const onConfirm = async () => {
    if (confirmModal.command) {
      try {
        await confirmModal.command();
      } catch (err) {
        if (!errorMessage(err).toLowerCase().includes("notallowederror")) {
          console.error("Error sending command:", err);
          notify.error(`Error sending command: ${errorMessage(err)}`);
        }
      }
    }
    setConfirmModal({ isOpen: false, command: null, label: "" });
  };

  const onCancel = () => {
    setConfirmModal({ isOpen: false, command: null, label: "" });
  };

  const menuItems = [
    {
      label: "Backup",
      value: backupConfig,
      prompt:
        "This will create a backup of Cato's current configuration on your system in a folder of your choice. Do you want to continue?",
    },
    {
      label: "Restore",
      value: restoreConfig,
      prompt:
        "Restoring a configuration will overwrite all your current settings. After restoration you must save the configuration. Do you want to continue?",
    },
    {
      label: "Check for Updates",
      value: onCheckForUpdates,
      prompt:
        "This will check for the latest firmware version.  If an updates are available, you will be prompted to select and install.",
    },
    {
      label: "Reset",
      otaCmd: "reboot",
      prompt:
        "Are you sure you want to reset? Any unsaved settings will be lost. Cato will disconnect and you will need to reconnect after rebooting.",
    },
    {
      label: "Upgrade",
      otaCmd: "reboot uf2",
      prompt:
        'This upgrade command is only for use with custom firmware. Most users should "Check for Updates" instead. It will reboot Cato into upgrade mode, allowing you to flash new firmware via USB by dragging and dropping a .uf2 file onto the Cato drive using your file manager. Are you sure you want to reboot into upgrade mode? ',
    },
    {
      label: "Factory Reset",
      otaCmd: "factory_reset",
      prompt:
        "Are you sure you want to factory reset? This will erase all your settings and bluetooth connections, and reboot the device into upgrade mode. Cato will disconnect and you will need to pair before reconnecting.",
    },
  ];

  const handleMenuItemClick = async (item) => {
    if (item) {
      let cmd;
      if (item.otaCmd) {
        cmd = async () => await ota.send(item.otaCmd);
      } else if (typeof item.value === "function") {
        cmd = item.value;
      }
      setConfirmModal({
        isOpen: true,
        command: cmd,
        label: item.label,
        prompt:
          item.prompt ||
          `Are you sure you want to ${item.label.toLowerCase()}?`,
      });
    }
    setIsMenuOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <>
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={onCancel}
        onConfirm={onConfirm}
      >
        <p>{confirmModal.prompt}</p>
      </ConfirmModal>
      <button
        onClick={disconnect}
      >
        Disconnect
      </button>
      <div style={{ position: "relative" }} ref={menuRef}>
        <button onClick={() => setIsMenuOpen((prev) => !prev)}>Manage</button>
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
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {menuItems.map((item) => (
                <li
                  key={item.label}
                  className="btn-ghost"
                  onClick={() => handleMenuItemClick(item)}
                  style={{
                    marginBottom: "0.1rem",
                    width: "100%",
                    padding: "0.5rem 1rem",
                    cursor: "pointer",
                    justifyContent: "flex-start",
                  }}
                >
                  {item.label}
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
