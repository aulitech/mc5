// ModelList.tsx — Saved gesture models: select one to chart its templates,
// download it as the device's xcorr_model.zip, or delete it.

import { useState } from "react";
import { useDialog } from "../../../context/DialogContext";
import { errorMessage, notify } from "../../../lib/notify";
import type { GestureModel } from "../../../types/gestures";
import { exportTemplatesZip } from "../lib/templateGen";
import { useGestureStore } from "../state/GestureStoreContext";
import GestureTemplateChart from "./GestureTemplateChart";
import styles from "../GestureTab.module.css";

const downloadModel = (model: GestureModel) =>
  exportTemplatesZip(
    Object.fromEntries(
      Object.entries(model.templates).map(([gestureName, { template }]) => [gestureName, template]),
    ),
  );

function ModelList() {
  const { models, deleteModel } = useGestureStore();
  const { confirm } = useDialog();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedModel = models.find((m) => m.id === selectedId);

  const handleDelete = async (model: GestureModel) => {
    if (await confirm(`Delete model "${model.modelName}"?`)) deleteModel(model.id);
  };

  return (
    <>
      {/* Column 3: Your Models */}
      <div className={styles.leftPanel}>
        <div className={styles.modelsSection}>
          {models.length === 0 ? (
            <p className={styles.emptyMsg}>Check gesture classes above, then click Generate.</p>
          ) : (
            <ul className={styles.modelList}>
              {models.map((model) => (
                <li
                  key={model.id}
                  className={`${styles.modelCard} ${model.id === selectedId ? styles.modelCardSelected : ""}`}
                  onClick={() => setSelectedId((prev) => (prev === model.id ? null : model.id))}
                  style={{ cursor: "pointer" }}
                >
                  <div className={styles.modelCardHeader}>
                    <button
                      className={`btn-plain ${styles.modelName}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId((prev) => (prev === model.id ? null : model.id));
                      }}
                      aria-pressed={model.id === selectedId}
                      title="Show this model's templates"
                    >
                      {model.modelName}
                    </button>
                    <div className={styles.modelCardActions}>
                      <button
                        className={styles.btn}
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadModel(model).catch((err) =>
                            notify.error(`Couldn't create the download: ${errorMessage(err)}`),
                          );
                        }}
                      >
                        Download
                      </button>
                      <button
                        className={styles.btnDanger}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(model);
                        }}
                        title="Delete this model"
                        aria-label={`Delete model "${model.modelName}"`}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <ul className={styles.modelGestureList}>
                    {Object.keys(model.templates).map((gestureName) => (
                      <li key={gestureName} className={styles.modelGestureItem}>
                        {gestureName}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Column 4: model template charts */}
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
    </>
  );
}

export default ModelList;
