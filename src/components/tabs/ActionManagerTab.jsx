import React, { useState } from "react";
import { Plus } from "lucide-react";
import { useConfig } from "../../context/ConfigContext";
import { Action } from "../modals/Action";
import ConfirmModal from "../modals/ConfirmModal";
import styles from "./ActionManager.module.css";

const ActionManagerTab = () => {
  const { actionList, setConfigValue, updateConfig } = useConfig();

  // send=false only updates the local copy (e.g. a new action still being edited).
  const updateActions = (newActions, send) => {
    const path = ["global_info", "action_list"];
    if (send) updateConfig(path, newActions);
    else setConfigValue(path, newActions);
  };
  const [editingIndex, setEditingIndex] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [newActionItem, setNewActionItem] = useState(null);

  const handleSave = (action, index) => {
    const newActionList = actionList.map((item, i) =>
      i === index ? action : item,
    );
    updateActions(newActionList, true);
    setEditingIndex(null);
  };

  const confirmDelete = () => {
    if (deleteCandidate !== null) {
      const newActionList = actionList.filter((_, i) => i !== deleteCandidate);
      updateActions(newActionList, true);
      setDeleteCandidate(null);
    }
  };

  const handleDeleteRequest = (index) => {
    setDeleteCandidate(index);
  };

  const handleAdd = () => {
    const newAction = {
      label: null,
      command: "noop"
    };
    const newActionList = [...actionList, newAction];
    updateActions(newActionList, false);
    // Set editing index to open the new action in edit mode immediately
    setEditingIndex(newActionList.length - 1);
    setNewActionItem(newActionList.length - 1);
  };

  const handleCancelAdd = (index) => {
    if (index !== null) {
      const newActionList = actionList.filter((_, i) => i !== index);
      updateActions(newActionList, true);
      setEditingIndex(null);
      setNewActionItem(null);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "large" }}>
          Actions ({actionList.length})
        </h3>
        <button
          className="btn btn-primary"
          style={{ padding: 0, margin: 0, gap: 0 }}
          onClick={handleAdd}
        >
          <Plus size={16} style={{ padding: 0, margin: 0 }} />
          New Action
        </button>
      </div>
      <ul
        className={styles["action-list-ul"]}
        style={{ overflowY: "auto", padding: 0, margin: 0 }}
      >
        {actionList.map((act, i) => (
          <Action
            key={i}
            idx={i}
            editingIndex={editingIndex}
            setEditingIndex={setEditingIndex}
            action={act}
            onCancel={() =>  handleCancelAdd(newActionItem) }
            onSave={handleSave}
            onDelete={handleDeleteRequest}
          />
        ))}
      </ul>
      <ConfirmModal
        isOpen={deleteCandidate !== null}
        onClose={() => setDeleteCandidate(null)}
        onConfirm={confirmDelete}
      >
        <p>
          Are you sure you want to delete the action "
          {deleteCandidate !== null && actionList[deleteCandidate]?.label}"?
        </p>
      </ConfirmModal>
    </div>
  );
};

export default ActionManagerTab;
