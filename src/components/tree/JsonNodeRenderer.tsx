import { useState, type ComponentType } from "react";
import { ChevronRight, ChevronDown, Box, Folder, Plus, Trash2, Info } from "lucide-react";
import LeafNode from "./LeafNode";
import { useConfig } from "../../context/ConfigContext";
import { useDevice } from "../../context/DeviceContext";
import { useSettings } from "../../context/SettingsContext";
import type { SchemaNode } from "../../constants/schemas";
import type { ConfigPath } from "../../types/config";
import { getSchema } from "../../utils/schema";
import AccelerationEditor, { type CustomEditorProps } from "../tools/AccelerationEditor";

import styles from "./Tree.module.css";

// Editors a schema node can name via `custom` to replace its default rendering.
const CUSTOM_EDITORS: Record<string, ComponentType<CustomEditorProps>> = {
  accelerationEditor: AccelerationEditor,
};

interface JsonNodeRendererProps {
  name: string;
  data: unknown;
  path: ConfigPath;
  isRootItem: boolean;
}

const JsonNodeRenderer = ({ name, data, path, isRootItem }: JsonNodeRendererProps) => {
  const { addConfigItem, deleteConfigItem } = useConfig();
  const { isAdvanced } = useSettings();
  const { gestureNames } = useDevice();

  const [isCollapsed, setIsCollapsed] = useState(!isRootItem && path.length > 2);

  const currentSchema = getSchema(path, gestureNames);
  const CustomEditor = currentSchema?.custom ? CUSTOM_EDITORS[currentSchema.custom] : undefined;
  const label = currentSchema?.label || name;
  const description = currentSchema?.description;

  if (currentSchema?.mode === "hidden" || (currentSchema?.mode === "advanced" && !isAdvanced)) {
    return null;
  }

  if (typeof data !== "object" || data === null) {
    return <LeafNode name={name} value={data} path={path} schema={currentSchema} />;
  }

  const isArray = Array.isArray(data);
  const entries: [key: string, value: unknown, displayName: string][] = isArray
    ? data.flatMap((item, index): [string, unknown, string][] => {
        if (currentSchema?.hiddenIndices?.includes(index)) return [];
        const names = currentSchema?.names;
        if (names && names.length <= index) return [];
        return [[`${index}`, item, names?.[index] || `${index}`]];
      })
    : Object.entries(data).map(([key, val]) => [key, val, key]);

  const handleAdd = () => {
    addConfigItem(path);
    setIsCollapsed(false);
  };

  const canDeleteItems = isArray && (currentSchema?._item as SchemaNode | undefined)?.allowDelete;

  return (
    <div className={styles["node-group"]}>
      {!isRootItem && (
        <div className={styles["group-header"]} style={{ width: "fit-content" }}>
          <button
            className={`btn-plain ${styles["group-toggle"]}`}
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-expanded={!isCollapsed}
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
          </button>

          {description && (
            <div className="tooltip-wrapper" tabIndex={0} style={{ marginLeft: "6px" }} aria-label={description}>
              <Info size={14} />
              <div className="tooltip-content">{description}</div>
            </div>
          )}

          {isArray && currentSchema?.allowAdd && (
            <button className="btn-ghost" style={{ marginLeft: "1rem" }} onClick={handleAdd} title="Add Item">
              <Plus size={16} />
            </button>
          )}
        </div>
      )}

      {(!isCollapsed || isRootItem) && (
        <div
          className={styles["group-children"]}
          style={isRootItem ? { marginLeft: 0, borderLeft: "none", paddingLeft: 0 } : undefined}
        >
          {CustomEditor ? (
            <CustomEditor data={data} path={path} schema={currentSchema} />
          ) : (
            entries.map(([key, value, displayName]) => (
              <div key={key} style={{ position: "relative" }}>
                <JsonNodeRenderer name={displayName} data={value} path={[...path, key]} isRootItem={false} />

                {canDeleteItems && (
                  <button
                    className="btn-ghost"
                    style={{ position: "absolute", right: "10px", top: "10px" }}
                    onClick={() => deleteConfigItem([...path, Number(key)])}
                    title={`Delete ${displayName}`}
                  >
                    <Trash2 size={16} color="var(--danger)" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default JsonNodeRenderer;
