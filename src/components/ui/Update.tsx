import { useState } from "react";
import RadioGroup from "../tools/RadioGroup";
import ota from "../../device/ota";
import { downloadBlob, saveWithPicker } from "../../lib/configFile";
import { errorMessage, notify } from "../../lib/notify";
import { fetchFirmwareAsset, type Release, type ReleaseAsset } from "../../lib/releases";
import { VStack, Ring } from "./Utility";

const UF2_TYPES: FilePickerAcceptType[] = [
  { description: "Cato Firmware", accept: { "application/octet-stream": [".uf2"] } },
];

interface UpdateProps {
  release: Release;
  /** Leave the update screen. */
  onClose: () => void;
}

const buttonStyle = {
  marginTop: "1rem",
  justifyContent: "center",
  display: "flex",
  padding: "0.5rem 1rem",
  border: "1px solid var(--color-input)",
  borderRadius: "0.25rem",
} as const;

/**
 * Two steps, so nothing happens to Cato until the firmware is in hand:
 * 1. Download the chosen .uf2 (no device side effects; can fail safely).
 * 2. Install: reboot Cato into its USB update drive, then save the file onto
 *    it. Each step is its own click, which the save dialog requires.
 */
const Update = ({ release, onClose }: UpdateProps) => {
  const [asset, setAsset] = useState<ReleaseAsset | undefined>(release.assets[0]);
  const [firmware, setFirmware] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    if (!asset) return;
    setBusy(true);
    try {
      setFirmware(await fetchFirmwareAsset(asset));
    } catch (err) {
      console.error("Download failed:", err);
      notify.error(`Couldn't download the firmware: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleInstall = async () => {
    if (!asset || !firmware) return;
    // Cato drops off USB HID as it reboots, so there's no response to wait for.
    ota.send("reboot uf2").catch(() => {});

    if (!("showSaveFilePicker" in window)) {
      downloadBlob(firmware, asset.name);
      notify.info("Firmware saved in Downloads. Drag it onto the AULI-UPDAT drive to install.");
      onClose();
      return;
    }
    try {
      if (await saveWithPicker(firmware, asset.name, UF2_TYPES)) {
        notify.success("Firmware sent. Cato will reboot and pair in about 30 seconds.");
        onClose();
      } else {
        notify.info(
          "Cato is in update mode. Press Install again, drag the file onto the AULI-UPDAT drive, or unplug Cato to cancel.",
        );
      }
    } catch (err) {
      console.error("SaveFilePicker error:", err);
      notify.error(`Couldn't save the firmware to Cato: ${errorMessage(err)}`);
    }
  };

  return (
    <div
      style={{
        maxWidth: "800px",
        marginTop: "2rem",
        padding: "2rem",
        color: "var(--color-card)",
      }}
    >
      <h3>Update Available: {release.name || release.tag_name}</h3>
      {release.assets.length === 0 ? (
        <p>This release has no firmware files.</p>
      ) : (
        <>
          <p>Please select a version:</p>
          <RadioGroup
            choices={release.assets}
            setChoice={(choice) => {
              setAsset(choice);
              setFirmware(null);
            }}
          />
        </>
      )}
      <VStack style={{ maxWidth: "800px", padding: "2rem" }}>
        {!firmware ? (
          <p>
            Make sure Cato is connected to your computer via USB, then click "Download" to fetch the
            firmware. Nothing changes on Cato until you install it.
          </p>
        ) : (
          <p>
            Downloaded. Click "Install": Cato will restart in update mode and a Save dialog will open.
            Select the "AULI-UPDAT" or "XIAO-SENSE" drive (it can take a few seconds to appear) and
            press Save. Don't unplug Cato until it reboots and pairs, about 30 seconds later. You can
            then reconnect myCato.
          </p>
        )}
        {busy ? (
          <Ring color="var(--led-blue)" />
        ) : (
          <div style={{ display: "flex", gap: "1rem" }}>
            <button style={buttonStyle} onClick={onClose}>
              Cancel
            </button>
            {!firmware ? (
              <button style={buttonStyle} onClick={handleDownload} disabled={!asset}>
                Download
              </button>
            ) : (
              <button style={buttonStyle} className="active" onClick={handleInstall}>
                Install
              </button>
            )}
          </div>
        )}
      </VStack>
    </div>
  );
};

export default Update;
