import { useState} from "react";
import { Save, Trash2, Pencil, X as CancelIcon, Keyboard } from "lucide-react";
import { calcModifierMask, getActionSummary } from "../../utils/helpers";
import { useConfig } from "../../context/ConfigContext";
import { notify } from "../../lib/notify";
import { HStack, VStack } from "../ui/Utility";
import KeyboardModal from "./KeyboardModal";
import {
  KEY_TO_HID,
  BUTTON_ACTIONS,
  MOUSE_OPTS,
  DEVICE_TYPES,
  SCROLL_TYPES,
} from "../../constants/mappings";
import styles from "../tabs/ActionManager.module.css";

export const Action = ({
  idx,
  action,
  onSave,
  onCancel,
  editingIndex,
  setEditingIndex,
  onDelete,
}) => {
  const [editedAction, setEditedAction] = useState(action);
  const isEditing = editingIndex === idx;
  const { actionNames } = useConfig();
{/*}
  useEffect(() => {
    // Reset local state if the action prop changes from outside,
    // or if we are no longer editing this item.
    if (!isEditing) {
      setEditedAction(action);
    }
  }, [action, isEditing]);
*/}
  const handleSave = () => {
    if (!editedAction.label) {
      notify.error("Label cannot be empty");
      return;
    }
    onSave(editedAction, idx);
  };
  const handleCancel = () => {
    // No need to revert state here as the useEffect will handle it
    setEditingIndex(null);
    setEditedAction(action);
    if (onCancel) {
      onCancel();
    }
  };

  const handleLabelChange = (e) => {
    const { name, value } = e.target;
    setEditedAction({
      ...editedAction,
      [name]: value,
    });
  };

  const handleCmdChange = (e) => {
    const { name, value } = e.target;
    let args = null;

    // Reset args when command changes to avoid invalid configurations
    if (value === "button") {
      if (
        editedAction.args &&
        DEVICE_TYPES.find((t) => t.value === editedAction.args[0])
      )
        args = editedAction.args;
      else args = [0, "tap", [1, 0]];
    } else if (value === "scroll") {
      if (
        editedAction.args &&
        SCROLL_TYPES.find((t) => t.value === editedAction.args[0])
      )
        args = editedAction.args;
      else args = ["fixed", 3];
    }

    setEditedAction({
      ...editedAction,
      [name]: value,
      args: args,
    });
  };

  const handleActorChange = (e) => {
    const value = parseInt(e.target.value, 10);
    let args = editedAction.args || [];

    // Reset args when command changes to avoid invalid configurations

    setEditedAction({
      ...editedAction,
      args: [value, ...args.slice(1)],
    });
  };

  const handleKeyChange = (newKeys) => {
    let args = editedAction.args || [];
    const key = newKeys.pop()?.toLowerCase() || "";
    const hidCode = KEY_TO_HID[key] || 0;

    const mods = calcModifierMask(newKeys);

    setEditedAction({
      ...editedAction,
      label: `${newKeys.join(" ")} ${key.toLowerCase()}`,
      args: [args[0], args[1], [hidCode, mods]],
    });
  };

  if (isEditing) {
    // RENDER EDITOR VIEW
    return (
      <li className={styles["action-item"] }>
        <HStack>
          <VStack style={{ gap: "0.5rem" }}>
            <HStack style={{ gap: "0.5rem", width: "100%" }}>
              <input
                type="text"
                name="label"
                placeholder={editedAction.label || "New Action"}
                value={editedAction.label || ""}
                onChange={handleLabelChange}
                autoFocus
                style={{  width: "100%" }}
              />

              <button
                className="btn-ghost"
                onClick={handleCancel}
                title="Cancel"
              >
                <CancelIcon color="var(--danger)" size={18} />
              </button>
              <button className="btn-ghost" onClick={handleSave} title="Save">
                <Save color="var(--success)" size={18} />
              </button>
            </HStack>
            <VStack style={{ gap: "0.5rem" }}>
              <HStack style={{ gap: "0.5rem", alignItems: "center" }}>
                <select
                  name="command"
                  id="cmd"
                  value={editedAction.command}
                  onChange={handleCmdChange}
                >
                  {actionNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                {editedAction.command === "button" && (
                  <>
                    <select
                      name="args[0]"
                      value={
                        editedAction.args
                          ? parseInt(editedAction.args[0], 10)
                          : 0
                      }
                      onChange={handleActorChange}
                    >
                      {DEVICE_TYPES.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {editedAction.args && editedAction.args[0] === 0 && (
                      <>
                        <select
                          name="args[1]"
                          value={editedAction.args[1]}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            setEditedAction({
                              ...editedAction,
                              args: [editedAction.args[0], newValue],
                            });
                          }}
                        >
                          {BUTTON_ACTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <select
                          name="args[2][0]"
                          value={
                            editedAction.args &&
                            Array.isArray(editedAction.args[2])
                              ? editedAction.args[2][0]
                              : editedAction.args[2]
                          }
                          onChange={(e) => {
                            const newValue = parseInt(e.target.value, 10);
                            setEditedAction({
                              ...editedAction,
                              args: [
                                editedAction.args[0],
                                editedAction.args[1],
                                [newValue, 0],
                              ],
                            });
                          }}
                        >
                          {MOUSE_OPTS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </>
                )}
              </HStack>
              {editedAction.command === "button" &&
                editedAction.args &&
                editedAction.args[0] === 1 && <KeyboardModal onPress={handleKeyChange} />}
            </VStack>
          </VStack>
          {/* TODO: Add inputs for other action properties like command and args */}
        </HStack>
      </li>
    );
  }

  // RENDER DISPLAY VIEW
  return (
    <li className={styles["action-item"]}>
      <div className={styles["item-left"]}>
        <div
          style={{
            fontFamily: "monospace",
            color: "var(--text-sub)",
            fontSize: "smaller",
            width: "1.2rem",
            flexShrink: 0,
          }}
        >
          {idx}
        </div>

        <div
          className={styles["action-content"]}
          onClick={() => setEditingIndex(idx)}
        >
          <span style={{ fontSize: "medium" }}>{action.label}</span>
          <div className={styles["meta-row"]}>{getActionSummary(action)}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "5px", marginLeft: "2rem" }}>
        <button className="btn-ghost btn-danger" onClick={() => onDelete(idx)}>
          <Trash2 size={18} color="var(--danger)" />
        </button>
      </div>
    </li>
  );
};
