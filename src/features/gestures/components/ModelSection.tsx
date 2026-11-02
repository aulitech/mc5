// ModelSection.tsx — The Model section: MODEL_SLOTS dropdowns choose the
// model's gestures, in order — each Unused, a personal (recorded) gesture or a
// pretrained (standard) one. Unused slots come only after the filled ones.
// "Install" (at the right end of the heading) builds the model, asks for Cato to be
// connected by USB, then saves xcorr_model.zip in Downloads and copies its
// files to an xcorr_model folder on Cato's drive (see data/catoDrive). The
// dialog shows that folder's path, and Change… chooses another drive. The
// dialog stays open until that's done, then offers to save Cato's settings
// and reboot it, since Cato reads the model when it starts.
// Any gesture can be viewed, with its template's graph, in the viewer.

import { HardDriveDownload } from "lucide-react";
import { useState } from "react";
import ConfirmModal from "../../../components/modals/ConfirmModal";
import { useDevice } from "../../../context/DeviceContext";
import ota from "../../../device/ota";
import { downloadBlob } from "../../../lib/configFile";
import { errorMessage, notify } from "../../../lib/notify";
import {
  MODEL_FOLDER,
  canWriteToDrive,
  chooseCatoDrive,
  openCatoDrive,
  rememberedCatoDrive,
  writeModelFolder,
} from "../data/catoDrive";
import { STANDARD_GESTURES } from "../data/standardGestures";
import { MODEL_SLOTS, parseSlotValue, slotLabel, slotValue } from "../lib/modelSlots";
import { buildModelFiles, buildModelZip } from "../lib/templateGen";
import { useGestureStore } from "../state/GestureStoreContext";
import styles from "../GestureTab.module.css";

const MODEL_ZIP = `${MODEL_FOLDER}.zip`;

type InstallStep =
  // `drive` is the drive chosen for Cato, or null if none is yet.
  | { step: "connect"; files: [string, string][]; drive: FileSystemDirectoryHandle | null }
  | { step: "installing" }
  // `drive` is Cato's drive's name, or null if only the zip was saved.
  | { step: "done"; drive: string | null }
  | { step: "rebooting" };

interface InstallActions {
  handleContinue: (files: [string, string][], drive: FileSystemDirectoryHandle | null) => void;
  handleChangeDrive: (files: [string, string][]) => void;
  handleSaveAndReboot: () => void;
  close: () => void;
}

/** The install dialog's text and buttons for a step. */
function installDialog(install: InstallStep | null, connected: boolean, actions: InstallActions) {
  const p = (text: string, last = false) => <p style={last ? { marginBottom: 0 } : { marginTop: 0 }}>{text}</p>;
  switch (install?.step) {
    case "connect":
      return {
        confirmLabel: "Continue",
        cancelLabel: "Cancel",
        onConfirm: () => actions.handleContinue(install.files, install.drive),
        body: (
          <>
            {p("Connect Cato to this computer with a USB cable, so it shows up as a drive.")}
            {canWriteToDrive() && (
              <p style={{ marginTop: 0, display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <span>
                  Cato:{" "}
                  {install.drive ? (
                    <code>
                      {install.drive.name}/{MODEL_FOLDER}
                    </code>
                  ) : (
                    "not chosen yet"
                  )}
                </span>
                <button
                  onClick={() => actions.handleChangeDrive(install.files)}
                  title="Choose Cato's drive (it's remembered for next time)"
                >
                  {install.drive ? "Change…" : "Choose…"}
                </button>
              </p>
            )}
            {p(
              !canWriteToDrive()
                ? `Continue saves ${MODEL_ZIP} in Downloads. This browser can't write to Cato's drive, so copy its ` +
                    `files to an ${MODEL_FOLDER} folder on Cato yourself.`
                : install.drive
                  ? `Continue saves ${MODEL_ZIP} in Downloads and copies the model to ` +
                    `${install.drive.name}/${MODEL_FOLDER}.`
                  : `Continue saves ${MODEL_ZIP} in Downloads and copies the model to an ${MODEL_FOLDER} folder on ` +
                    "Cato. Choose Cato's drive and allow MyCato to edit it; it's remembered for next time.",
              true,
            )}
          </>
        ),
      };
    case "installing":
      return {
        confirmLabel: "Installing…",
        cancelLabel: "Cancel",
        onConfirm: () => {},
        body: p("Installing the model on Cato. Don't unplug it.", true),
      };
    case "done":
      if (!install.drive) {
        return {
          confirmLabel: "Close",
          cancelLabel: null,
          onConfirm: actions.close,
          body: p(
            `${MODEL_ZIP} is saved in Downloads. To install it, copy its files to an ${MODEL_FOLDER} folder on ` +
              "Cato's drive, then reboot Cato.",
            true,
          ),
        };
      }
      return connected
        ? {
            confirmLabel: "Save and reboot",
            cancelLabel: "Not now",
            onConfirm: actions.handleSaveAndReboot,
            body: (
              <>
                {p(`Model installed in ${install.drive}/${MODEL_FOLDER}. A copy, ${MODEL_ZIP}, is in Downloads.`)}
                {p("Cato uses the new model once it restarts. Save Cato's settings and reboot it now?", true)}
              </>
            ),
          }
        : {
            confirmLabel: "Close",
            cancelLabel: null,
            onConfirm: actions.close,
            body: (
              <>
                {p(`Model installed in ${install.drive}/${MODEL_FOLDER}. A copy, ${MODEL_ZIP}, is in Downloads.`)}
                {p(
                  "Cato uses the new model once it restarts: connect it here to save and reboot, or restart it.",
                  true,
                )}
              </>
            ),
          };
    case "rebooting":
      return {
        confirmLabel: "Saving…",
        cancelLabel: "Not now",
        onConfirm: () => {},
        body: p("Saving Cato's settings, then rebooting it.", true),
      };
    default:
      return { confirmLabel: "Continue", cancelLabel: "Cancel", onConfirm: () => {}, body: null };
  }
}

function ModelSection() {
  const { modelSlots, setModelSlot, gestureOrder, counts, isGenerating, buildModel } = useGestureStore();
  // Personal gestures with recordings to build from.
  const personal = gestureOrder.filter((name) => counts[name] > 0);
  const { device } = useDevice();
  // The install dialog's step, from "connect Cato" to the outcome.
  const [install, setInstall] = useState<InstallStep | null>(null);
  const isInstalling = install !== null && install.step !== "connect";
  const busy = isGenerating || isInstalling;
  const working = install?.step === "installing" || install?.step === "rebooting";

  // Build first, so a gesture that can't be built is reported before asking for Cato.
  const handleInstall = async () => {
    const templates = await buildModel();
    if (!templates) return;
    const drive = canWriteToDrive() ? await rememberedCatoDrive() : null;
    setInstall({ step: "connect", files: buildModelFiles(templates), drive });
  };

  // Choose another drive for Cato: Continue installs there, and it's remembered.
  const handleChangeDrive = async (files: [string, string][]) => {
    try {
      const drive = await chooseCatoDrive();
      if (drive) setInstall({ step: "connect", files, drive });
    } catch (err) {
      notify.error(`Couldn't choose the drive: ${errorMessage(err)}`);
    }
  };

  const handleContinue = async (files: [string, string][], chosen: FileSystemDirectoryHandle | null) => {
    setInstall({ step: "installing" });
    try {
      // Ask for the drive straight from the click: picking and permission need it.
      const drive = canWriteToDrive() ? await openCatoDrive(chosen) : null;
      downloadBlob(await buildModelZip(files), MODEL_ZIP);
      if (drive) await writeModelFolder(drive, files);
      setInstall({ step: "done", drive: drive?.name ?? null });
    } catch (err) {
      setInstall(null);
      notify.error(`Couldn't install the model: ${errorMessage(err)}`);
    }
  };

  // Cato reads the model when it starts. Saved first, so a reboot doesn't
  // lose settings changed since the last save.
  const handleSaveAndReboot = async () => {
    setInstall({ step: "rebooting" });
    try {
      await ota.send("config save");
    } catch (err) {
      setInstall(null);
      notify.error(`Couldn't save Cato's settings, so it wasn't rebooted: ${errorMessage(err)}`);
      return;
    }
    // Cato drops off USB HID as it reboots, so there's no answer to wait for.
    ota.send("reboot").catch(() => {});
    setInstall(null);
    notify.success("Settings saved. Cato is rebooting with the new model: reconnect when it's back.");
  };

  const close = () => setInstall(null);
  const dialog = installDialog(install, device !== null, {
    handleContinue,
    handleChangeDrive,
    handleSaveAndReboot,
    close,
  });

  return (
    <>
      <div className={styles.modelSection}>
        <div className={styles.modelHeader}>
          <h3 className={styles.pageSectionTitle}>Model</h3>
          <button
            className={`btn-primary ${styles.addBtn}`}
            onClick={handleInstall}
            disabled={modelSlots.length === 0 || busy}
            title={
              modelSlots.length === 0 ? "Choose a gesture for slot 1 first" : "Build the model and install it on Cato"
            }
          >
            <HardDriveDownload size={16} />
            {isGenerating ? "Building…" : isInstalling ? "Installing…" : "Install"}
          </button>
        </div>
        <ol className={styles.modelSlots}>
          {Array.from({ length: MODEL_SLOTS }, (_, i) => {
            const slot = modelSlots[i];
            // A gesture fills one slot at most, so the other slots' choices are left out.
            const taken = new Set(modelSlots.filter((_, j) => j !== i).map(slotLabel));
            // A slot keeps its gesture if that loses its recordings (Install then names it).
            const own = slot?.kind === "personal" && !personal.includes(slot.name) ? [slot.name] : [];
            const personalChoices = [...personal, ...own].filter((name) => !taken.has(name));
            const pretrainedChoices = STANDARD_GESTURES.filter((g) => !taken.has(g.label));
            const id = `model-slot-${i}`;
            return (
              <li key={i} className={styles.modelSlot}>
                <label htmlFor={id} className={styles.modelSlotNumber}>
                  {i + 1}
                </label>
                <select
                  id={id}
                  className={`input-base ${styles.modelSlotSelect}`}
                  value={slotValue(slot)}
                  onChange={(e) => setModelSlot(i, parseSlotValue(e.target.value))}
                  disabled={i > modelSlots.length || busy} // fill the slots in order
                  aria-label={`Model gesture ${i + 1}`}
                >
                  <option value="">Unused</option>
                  {personalChoices.length > 0 && (
                    <optgroup label="Personal">
                      {personalChoices.map((name) => (
                        <option key={name} value={slotValue({ kind: "personal", name })}>
                          {name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Pretrained">
                    {pretrainedChoices.map((g) => (
                      <option key={g.id} value={slotValue({ kind: "pretrained", id: g.id })}>
                        {g.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </li>
            );
          })}
        </ol>
      </div>
      <ConfirmModal
        isOpen={install !== null}
        onClose={close}
        onConfirm={dialog.onConfirm}
        confirmLabel={dialog.confirmLabel}
        cancelLabel={dialog.cancelLabel}
        busy={working}
      >
        {dialog.body}
      </ConfirmModal>
    </>
  );
}

export default ModelSection;
