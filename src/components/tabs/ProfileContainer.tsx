import { useState, type SyntheticEvent } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { HStack } from "../ui/Utility";
import { useConfig } from "../../context/ConfigContext";
import { useDialog } from "../../context/DialogContext";
import { useSettings } from "../../context/SettingsContext";
import type { Profile } from "../../types/config";
import JsonNodeRenderer from "../tree/JsonNodeRenderer";
import styles from "../tree/Tree.module.css";

interface ProfileContainerProps {
  index: number;
  data: Profile;
}

// Clicks/keys inside the summary would otherwise toggle the <details>.
const stop = (e: SyntheticEvent) => {
  e.stopPropagation();
  e.preventDefault();
};

const ProfileContainer = ({ index, data }: ProfileContainerProps) => {
  const { updateConfig, deleteConfigItem } = useConfig();
  const { isAdvanced } = useSettings();
  const { confirm } = useDialog();

  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(data.name);
  const displayName = data.name || `Profile ${index}`;

  const handleSaveName = (e: SyntheticEvent) => {
    stop(e);
    const name = tempName.trim();
    if (name && name !== data.name) updateConfig(["profiles", index, "name"], name);
    setIsEditing(false);
  };

  const handleCancelEdit = (e: SyntheticEvent) => {
    stop(e);
    setIsEditing(false);
  };

  const handleDelete = async (e: SyntheticEvent) => {
    stop(e);
    if (await confirm(`Are you sure you want to delete "${displayName}"?`)) {
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
        <HStack
          style={{
            display: "inline-flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--bg-card)",
            padding: 0,
            width: "fit-content",
          }}
        >
          <div style={{ marginLeft: "0.25rem" }}>
            {isEditing ? (
              <div style={{ display: "flex", gap: "0.5rem" }} onClick={stop}>
                <input
                  className="input-base"
                  aria-label="Profile name"
                  style={{ padding: "0.25rem 0.5rem", width: "200px" }}
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={(e) => {
                    // Space/Enter would toggle the <details> from inside its summary.
                    if (e.key === " ") e.stopPropagation();
                    if (e.key === "Enter") handleSaveName(e);
                    if (e.key === "Escape") handleCancelEdit(e);
                  }}
                  onKeyUp={(e) => e.key === " " && e.preventDefault()}
                  autoFocus
                />
                <button className="btn-ghost" onClick={handleSaveName} title="Save name">
                  <Check size={16} className="text-green-500" />
                </button>
                <button className="btn-ghost" onClick={handleCancelEdit} title="Cancel">
                  <X size={16} className="text-red-500" />
                </button>
              </div>
            ) : (
              <span style={{ fontWeight: 700, fontSize: "medium" }}>{displayName}</span>
            )}
          </div>
          <div style={{ display: "flex", marginLeft: "1rem", gap: "0.5rem" }}>
            {!isEditing && (
              <button
                className="btn-ghost"
                onClick={(e) => {
                  stop(e);
                  setTempName(data.name);
                  setIsEditing(true);
                }}
                data-tooltip="Edit Profile"
                aria-label={`Rename ${displayName}`}
              >
                <Pencil size={16} color="var(--success)" />
              </button>
            )}
            {isAdvanced && (
              <button
                className="btn-ghost btn-danger"
                onClick={handleDelete}
                data-tooltip="Delete Profile"
                aria-label={`Delete ${displayName}`}
              >
                <Trash2 size={16} color="var(--danger)" />
              </button>
            )}
          </div>
        </HStack>
      </summary>
      <div
        className={styles["group-children"]}
        style={{
          borderLeft: "1px solid var(--border)",
          marginLeft: "19px", // Aligns with the chevron
          paddingLeft: "1rem",
          marginTop: "0.5rem",
        }}
      >
        <JsonNodeRenderer name={displayName} data={data} path={["profiles", index]} isRootItem={true} />
      </div>
    </details>
  );
};

export default ProfileContainer;
