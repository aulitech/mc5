import React, { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  User,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { HStack, VStack } from "../ui/Utility";
import { useConfig } from "../../context/ConfigContext";
import { useDialog } from "../../context/DialogContext";
import { useSettings } from "../../context/SettingsContext";
import JsonNodeRenderer from "../tree/JsonNodeRenderer";
import styles from "../tree/Tree.module.css";

const ProfileContainer = ({ index, data }) => {
  const { updateConfig, deleteConfigItem } = useConfig();
  const { isAdvanced } = useSettings();
  const { confirm } = useDialog();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(data.name);

  const handleSaveName = (e) => {
    e.stopPropagation();
    updateConfig(["profiles", index, "name"], tempName);
    setIsEditing(false);
  };

  const handleCancelEdit = (e) => {
    e.stopPropagation();
    setTempName(data.name);
    setIsEditing(false);
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (await confirm(`Are you sure you want to delete "${data.name}"?`)) {
      deleteConfigItem(["profiles", index]);
    }
  };

  return (
  <details style={{ width: "fit-content", overflowY: "auto" }}>
      <summary
        style={{
          border: "1px solid var(--border)",
          borderRadius: ".5rem",
          padding: ".75rem",
        }}
      >
        {/* Header */}
        <HStack
          onClick={() => !isEditing && setIsCollapsed(!isCollapsed)}
          style={{
            display: "inline-flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--bg-card)",
            padding: 0,
            cursor: isEditing ? "default" : "pointer",
            width: "fit-content",
                        // Optional: Add rounded corners here if you want the header to look like a standalone box
          }}
        >
          <div style={{  marginLeft: "0.25rem" }}>
            {isEditing ? (
              <div
                style={{ display: "flex", gap: "0.5rem" }}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  className="input-base"
                  style={{ padding: "0.25rem 0.5rem", width: "200px" }}
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName(e);
                    if (e.key === "Escape") handleCancelEdit(e);
                  }}
                  autoFocus
                />
                <button className="btn-ghost" onClick={handleSaveName}>
                  <Check size={16} className="text-green-500" />
                </button>
                <button className="btn-ghost" onClick={handleCancelEdit}>
                  <X size={16} className="text-red-500" />
                </button>
              </div>
            ) : (
              <div>
                <span style={{ fontWeight: 700, fontSize: "medium" }}>
                  {data.name || `Profile ${index}`}
                </span>
              </div>
            )}
          </div>
          <div
            style={{ display: "flex",marginLeft: "1rem", gap: "0.5rem" }}
            onClick={(e) => e.stopPropagation()}
          >
            {!isEditing && (
              <button
                className="btn-ghost"
                onClick={() => {
                  setTempName(data.name);
                  setIsEditing(true);
                }}
                data-tooltip="Edit Profile" // ADDED
              >
                <Pencil size={16} color="var(--success)" />
              </button>
            )}
            {isAdvanced && (
              <button
                className="btn-ghost btn-danger"
                onClick={handleDelete}
                data-tooltip="Delete Profile" // ADDED
              >
                <Trash2 size={16} color="var(--danger)" />
              </button>
            )}
          </div>
        </HStack>
      </summary>
      {/* Body Content */}
      <div
        className={styles["group-children"]}
        style={{
          borderLeft: "1px solid var(--border)",
          marginLeft: "19px", // Aligns with the chevron
          paddingLeft: "1rem",
          // FIXED: Removed negative margin to prevent overlap
          marginTop: "0.5rem",
        }}
      >
        <JsonNodeRenderer
          name={data.name}
          data={data}
          path={["profiles", index]}
          isRootItem={true}
        />
      </div>
    </details>
  );
};

export default ProfileContainer;
