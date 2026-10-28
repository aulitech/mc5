import React, { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Box,
  Folder,
  Plus,
  Trash2,
  TrendingUp,
  Info, // <--- NEW IMPORT
} from "lucide-react";
import LeafNode from "./LeafNode";
import { useConfig } from "../../context/ConfigContext";
import { useDevice } from "../../context/DeviceContext";
import { useSettings } from "../../context/SettingsContext";
import { getSchema } from "../../utils/schema";
import AccelerationEditor from "../tools/AccelerationEditor";

import styles from "./Tree.module.css";

// Editors a schema node can name via `custom` to replace its default rendering.
// Each receives the node's { data, path, schema }.
const CUSTOM_EDITORS = {
  accelerationEditor: AccelerationEditor,
};

const JsonNodeRenderer = ({ name, data, path, isRootItem }) => {
  const { addConfigItem, deleteConfigItem } = useConfig();
  const { isAdvanced } = useSettings();
  const { gestureNames } = useDevice();
  // console.warn("path:", path, "data:", data);

  const [isCollapsed, setIsCollapsed] = useState(
    !isRootItem && path.length > (isRootItem ? 0 : 2),
  );

  // const [showGraph, setShowGraph] = useState(false);

  const currentSchema = getSchema(path, gestureNames);
  const CustomEditor = CUSTOM_EDITORS[currentSchema?.custom];
  const isGroup = typeof data === "object" && data !== null;
  const isArray = Array.isArray(data);
  const label = currentSchema?.label || name;

  // <--- NEW: Extract description from schema
  const description = currentSchema?.description;

  if (
    currentSchema?.mode === "hidden" ||
    (currentSchema?.mode === "advanced" && !isAdvanced)
  ) {
    return null;
  }

  if (!isGroup && !Array.isArray(data)) {
    return (
      <LeafNode name={name} value={data} path={path} schema={currentSchema} />
    );
  }

  const entries = isArray
    ? data
        .map((item, index) => {
          if (currentSchema?.hiddenIndices?.includes(index)) return null;
          if (currentSchema?.names?.length <= index) return null;
          const customName = currentSchema?.names?.[index];
          const displayName = customName || `${index}`;
          return [`${index}`, item, displayName];
        })
        .filter(Boolean)
    : Object.entries(data).map(([key, val]) => [key, val, key]);

  const handleAdd = (e) => {
    e.stopPropagation();
    addConfigItem(path);
    setIsCollapsed(false);
  };

  return (
    <div className={styles["node-group"]}>
      {!isRootItem && (
        <div
          className={styles["group-header"]}
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{ width: "fit-content" }}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          {isArray ? (
            <Box size={16} className="text-amber-500" />
          ) : (
            <Folder size={16} className="text-indigo-500" />
          )}
          <span
            className={`${styles["group-label"]} ${styles["label-text"]}`}
            style={{ fontSize: "medium", fontWeight: 600 }}
          >
            {label}
          </span>

          {/* <--- NEW: RENDER FOLDER TOOLTIP ---> */}
          {description && (
            <div
              className="tooltip-wrapper"
              onClick={(e) => e.stopPropagation()} // Prevent collapse when clicking tooltip
              style={{ marginLeft: "6px" }}
            >
              <Info size={14} />
              <div className="tooltip-content">{description}</div>
            </div>
          )}

          <div
            style={{ marginLeft: "1rem", display: "flex", gap: "0.5rem" }}
            onClick={(e) => e.stopPropagation()}
          >
            {isArray && currentSchema?.allowAdd && (
              <button
                className="btn-ghost"
                onClick={handleAdd}
                title="Add Item"
              >
                <Plus size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {(!isCollapsed || isRootItem) && (
        <div
          className={styles["group-children"]}
          style={
            isRootItem
              ? { marginLeft: 0, borderLeft: "none", paddingLeft: 0 }
              : undefined
          }
        >
          {CustomEditor
            ? <CustomEditor data={data} path={path} schema={currentSchema} />
            : entries.map(([key, value, displayName]) => (
                <div key={key} style={{ position: "relative" }}>
                  <JsonNodeRenderer
                    name={displayName}
                    data={value}
                    path={[...path, key]}
                    isRootItem={false}
                  />

                  {isArray && currentSchema?._item?.allowDelete && (
                    <button
                      className="btn-ghost"
                      style={{
                        position: "absolute",
                        right: "10px",
                        top: "10px",
                      }}
                      onClick={() => deleteConfigItem([...path, key])}
                    >
                      <Trash2 size={16} color="var(--danger)" />
                    </button>
                  )}
                </div>
              ))}
        </div>
      )}

    </div>
  );
};

export default JsonNodeRenderer;
