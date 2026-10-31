// ModelList.tsx — The Models section: "+ Model" (under its heading)
// generates a gesture model from the checked gestures; select one to chart
// its templates, show its gestures, install it (save the device's
// xcorr_model.zip), or delete it.

import { HardDriveDownload, Plus, Trash2 } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { useDialog } from "../../../context/DialogContext";
import { downloadBlob, saveWithPicker } from "../../../lib/configFile";
import { errorMessage, notify } from "../../../lib/notify";
import type { GestureModel } from "../../../types/gestures";
import { buildTemplatesZip } from "../lib/templateGen";
import { useGestureStore } from "../state/GestureStoreContext";
import DisclosureTriangle from "./DisclosureTriangle";
import GestureTemplateChart from "./GestureTemplateChart";
import styles from "../GestureTab.module.css";

const MODEL_FILENAME = "xcorr_model.zip";
const ZIP_TYPES: FilePickerAcceptType[] = [
  { description: "Cato gesture model", accept: { "application/zip": [".zip"] } },
];

// Save the model as xcorr_model.zip, via the save picker so it can go
// straight onto Cato's drive (or a download, where there's no picker).
async function installModel(model: GestureModel) {
  const blob = await buildTemplatesZip(
    Object.fromEntries(
      Object.entries(model.templates).map(([gestureName, { template }]) => [gestureName, template]),
    ),
  );
  if ("showSaveFilePicker" in window) {
    await saveWithPicker(blob, MODEL_FILENAME, ZIP_TYPES);
    return;
  }
  downloadBlob(blob, MODEL_FILENAME);
  notify.info(`${MODEL_FILENAME} saved in Downloads folder.`);
}

function ModelList() {
  const { models, deleteModel, checkedClasses, checkedStandards, isGenerating, generateModel } =
    useGestureStore();
  const { confirm, prompt } = useDialog();
  const nothingChecked = checkedClasses.size === 0 && checkedStandards.size === 0;

  const handleGenerate = async () => {
    const modelName = (await prompt("Name this model:"))?.trim();
    if (modelName) await generateModel(modelName);
  };
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedModel = models.find((m) => m.id === selectedId);
  // Models whose gesture list is showing.
  const [openIds, setOpenIds] = useState<Set<number>>(() => new Set());

  const toggleOpen = (e: MouseEvent, id: number) => {
    e.stopPropagation(); // showing the contents doesn't select the model
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async (model: GestureModel) => {
    if (await confirm(`Delete model "${model.modelName}"?`)) deleteModel(model.id);
  };

  return (
    <>
      {/* Heading, with "+ Model" under it (like "Add Profile") */}
      <div className={styles.pageSectionHeader}>
        <h3 className={styles.pageSectionTitle}>Models</h3>
        <button
          className={`btn-primary ${styles.addBtn}`}
          onClick={handleGenerate}
          disabled={nothingChecked || isGenerating}
          title={nothingChecked ? "Check saved or standard gestures first" : "Build a model from the checked gestures"}
        >
          <Plus size={16} />
          {isGenerating ? "Generating…" : "Model"}
        </button>
      </div>
      <div className={styles.pageSectionBody}>
        <div className={styles.leftPanel}>
          <div className={styles.modelsSection}>
            {models.length === 0 ? (
              <p className={styles.emptyMsg}>Check gestures in the list on the left, then click + Model.</p>
            ) : (
              <ul className={styles.modelList}>
                {models.map((model) => {
                  const open = openIds.has(model.id);
                  return (
                    <li
                      key={model.id}
                      className={`${styles.modelCard} ${model.id === selectedId ? styles.modelCardSelected : ""}`}
                      onClick={() => setSelectedId((prev) => (prev === model.id ? null : model.id))}
                      style={{ cursor: "pointer" }}
                    >
                      <div className={styles.modelCardHeader}>
                        <button
                          className={`btn-plain ${styles.disclosure} ${open ? styles.disclosureOpen : ""}`}
                          onClick={(e) => toggleOpen(e, model.id)}
                          aria-expanded={open}
                          aria-label={`${open ? "Hide" : "Show"} the gestures in "${model.modelName}"`}
                          title={`${open ? "Hide" : "Show"} gestures`}
                        >
                          <DisclosureTriangle />
                        </button>
                        <button
                          className={`btn-plain ${styles.modelName}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId((prev) => (prev === model.id ? null : model.id));
                          }}
                          aria-pressed={model.id === selectedId}
                          title={`${model.modelName}: show its templates`}
                        >
                          {model.modelName}
                        </button>
                        <button
                          className="btn-ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            installModel(model).catch((err) =>
                              notify.error(`Couldn't save ${MODEL_FILENAME}: ${errorMessage(err)}`),
                            );
                          }}
                          title={`Install: save as ${MODEL_FILENAME} for Cato`}
                          aria-label={`Install "${model.modelName}" (save ${MODEL_FILENAME})`}
                        >
                          <HardDriveDownload size={16} />
                        </button>
                        <button
                          className="btn-ghost btn-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(model);
                          }}
                          title="Delete this model"
                          aria-label={`Delete model "${model.modelName}"`}
                        >
                          <Trash2 size={16} color="var(--danger)" />
                        </button>
                      </div>
                      {open && (
                        <ul className={styles.modelGestureList}>
                          {Object.keys(model.templates).map((gestureName) => (
                            <li key={gestureName} className={styles.modelGestureItem}>
                              {gestureName}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Model template charts */}
        <div className={styles.rightPanel}>
          {selectedModel && (
            <div className={styles.modelCharts}>
              <h4 className={styles.modelChartsTitle}>{selectedModel.modelName}</h4>
              {Object.entries(selectedModel.templates).map(([gestureName, { template }]) => (
                <div key={gestureName} className={styles.chartWrap}>
                  <GestureTemplateChart template={template} gestureName={gestureName} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default ModelList;
