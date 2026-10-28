import { useState, type ChangeEvent } from "react";
import { Save, Trash2, X as CancelIcon } from "lucide-react";
import { calcModifierMask, getActionSummary, splitButtonCode } from "../../utils/helpers";
import { useConfig } from "../../context/ConfigContext";
import { notify } from "../../lib/notify";
import type { ButtonArgs, ConfigAction } from "../../types/config";
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

const DEFAULT_BUTTON_ARGS: ButtonArgs = [0, "tap", [1, 0]];

interface ActionRowProps {
  idx: number;
  action: ConfigAction;
  onEdit: (idx: number) => void;
  onDelete: (idx: number) => void;
}

/** Read-only row for one action; selecting it opens the editor. */
export const ActionRow = ({ idx, action, onEdit, onDelete }: ActionRowProps) => (
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

      <button
        className={`btn-plain ${styles["action-content"]}`}
        onClick={() => onEdit(idx)}
        title="Edit action"
      >
        <span style={{ fontSize: "medium" }}>{action.label}</span>
        <div className={styles["meta-row"]}>{getActionSummary(action)}</div>
      </button>
    </div>
    <div style={{ display: "flex", gap: "5px", marginLeft: "2rem" }}>
      <button
        className="btn-ghost btn-danger"
        onClick={() => onDelete(idx)}
        title={`Delete "${action.label ?? ""}"`}
      >
        <Trash2 size={18} color="var(--danger)" />
      </button>
    </div>
  </li>
);

interface ActionEditorProps {
  /** The action as it is now; edits stay local until Save. */
  action: ConfigAction;
  onSave: (action: ConfigAction) => void;
  onCancel: () => void;
}

/**
 * Editor for one action. Mounted only while editing, so it always starts
 * from the action's current value.
 */
export const ActionEditor = ({ action, onSave, onCancel }: ActionEditorProps) => {
  const [editedAction, setEditedAction] = useState<ConfigAction>(action);
  const { actionNames } = useConfig();
  const buttonArgs =
    editedAction.command === "button" ? ((editedAction.args as ButtonArgs | null) ?? DEFAULT_BUTTON_ARGS) : null;

  const handleSave = () => {
    const label = editedAction.label?.trim();
    if (!label) {
      notify.error("Label cannot be empty");
      return;
    }
    onSave({ ...editedAction, label });
  };

  const handleCmdChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const command = e.target.value;
    const current = editedAction.args;
    let args: unknown[] | null = null;

    // Reset args when command changes to avoid invalid configurations
    if (command === "button") {
      args = current && DEVICE_TYPES.some((t) => t.value === current[0]) ? current : DEFAULT_BUTTON_ARGS;
    } else if (command === "scroll") {
      args = current && SCROLL_TYPES.some((t) => t.value === current[0]) ? current : ["fixed", 3];
    }
    setEditedAction({ ...editedAction, command, args });
  };

  const setButtonArgs = (next: ButtonArgs) => setEditedAction({ ...editedAction, args: next });

  // A mouse button number isn't a valid key code (or vice versa), so
  // switching device clears the code.
  const handleActorChange = (e: ChangeEvent<HTMLSelectElement>) => {
    if (!buttonArgs) return;
    setButtonArgs([parseInt(e.target.value, 10), buttonArgs[1], [0, 0]]);
  };

  const handleKeyChange = (pressed: string[]) => {
    if (!buttonArgs) return;
    const mods = pressed.slice(0, -1);
    const key = pressed[pressed.length - 1]?.toLowerCase() ?? "";
    const hidCode = KEY_TO_HID[key] ?? 0;
    setEditedAction({
      ...editedAction,
      label: [...mods, key].join(" ").trim(),
      args: [buttonArgs[0], buttonArgs[1], [hidCode, calcModifierMask(mods)]],
    });
  };

  return (
    <li className={styles["action-item"]}>
      <HStack>
        <VStack style={{ gap: "0.5rem" }}>
          <HStack style={{ gap: "0.5rem", width: "100%" }}>
            <input
              type="text"
              name="label"
              aria-label="Action label"
              placeholder={editedAction.label || "New Action"}
              value={editedAction.label || ""}
              onChange={(e) => setEditedAction({ ...editedAction, label: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") onCancel();
              }}
              autoFocus
              style={{ width: "100%" }}
            />

            <button className="btn-ghost" onClick={onCancel} title="Cancel">
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
                aria-label="Command"
                value={editedAction.command}
                onChange={handleCmdChange}
              >
                {actionNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              {buttonArgs && (
                <>
                  <select aria-label="Device" value={buttonArgs[0]} onChange={handleActorChange}>
                    {DEVICE_TYPES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {buttonArgs[0] === 0 && (
                    <>
                      <select
                        aria-label="Press type"
                        value={buttonArgs[1]}
                        onChange={(e) => setButtonArgs([buttonArgs[0], e.target.value, buttonArgs[2]])}
                      >
                        {BUTTON_ACTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="Mouse button"
                        value={splitButtonCode(buttonArgs[2])[0]}
                        onChange={(e) =>
                          setButtonArgs([buttonArgs[0], buttonArgs[1], [parseInt(e.target.value, 10), 0]])
                        }
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
            {buttonArgs?.[0] === 1 && <KeyboardModal onPress={handleKeyChange} />}
          </VStack>
        </VStack>
      </HStack>
    </li>
  );
};
