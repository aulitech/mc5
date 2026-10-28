import { useState } from "react";
import { Plus } from "lucide-react";
import { useConfig } from "../../context/ConfigContext";
import { planActionDelete } from "../../lib/configEdits";
import type { ConfigAction } from "../../types/config";
import { ActionEditor, ActionRow } from "../modals/Action";
import ConfirmModal from "../modals/ConfirmModal";
import styles from "./ActionManager.module.css";

const ACTION_LIST_PATH = ["global_info", "action_list"];
const NEW_ACTION: ConfigAction = { label: null, command: "noop" };

const ActionManagerTab = () => {
  const { data, actionList, updateConfig, deleteAction } = useConfig();

  // Either an existing action is being edited, or a new one (`draft`) that
  // isn't in the config until it's saved.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<ConfigAction | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<number | null>(null);

  const startEdit = (index: number) => {
    setDraft(null);
    setEditingIndex(index);
  };

  const handleAdd = () => {
    setEditingIndex(null);
    setDraft(NEW_ACTION);
  };

  const saveExisting = (index: number, action: ConfigAction) => {
    updateConfig(ACTION_LIST_PATH, actionList.map((item, i) => (i === index ? action : item)));
    setEditingIndex(null);
  };

  const saveDraft = (action: ConfigAction) => {
    updateConfig(ACTION_LIST_PATH, [...actionList, action]);
    setDraft(null);
  };

  const confirmDelete = async () => {
    if (deleteCandidate === null) return;
    const index = deleteCandidate;
    setDeleteCandidate(null);
    setEditingIndex(null);
    await deleteAction(index);
  };

  const deletePlan = data && deleteCandidate !== null ? planActionDelete(data, deleteCandidate) : null;
  const fallbackLabel = deletePlan?.fallback != null ? deletePlan.actionList[deletePlan.fallback]?.label : null;

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
        <h3 style={{ margin: 0, fontSize: "large" }}>Actions ({actionList.length})</h3>
        <button
          className="btn btn-primary"
          style={{ padding: 0, margin: 0, gap: 0 }}
          onClick={handleAdd}
          disabled={draft !== null}
        >
          <Plus size={16} style={{ padding: 0, margin: 0 }} />
          New Action
        </button>
      </div>
      <ul className={styles["action-list-ul"]} style={{ overflowY: "auto", padding: 0, margin: 0 }}>
        {actionList.map((act, i) =>
          editingIndex === i ? (
            <ActionEditor
              key={`edit-${i}`}
              action={act}
              onSave={(action) => saveExisting(i, action)}
              onCancel={() => setEditingIndex(null)}
            />
          ) : (
            <ActionRow key={i} idx={i} action={act} onEdit={startEdit} onDelete={setDeleteCandidate} />
          ),
        )}
        {draft && <ActionEditor key="new" action={draft} onSave={saveDraft} onCancel={() => setDraft(null)} />}
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
        {deletePlan === null ? (
          <p>It's bound to a gesture or tap and there's no “Do Nothing” action to switch it to, so it can't be deleted yet.</p>
        ) : deletePlan.inUse > 0 ? (
          <p>
            It's used by {deletePlan.inUse} gesture/tap binding(s); they'll switch to "{fallbackLabel}".
          </p>
        ) : null}
      </ConfirmModal>
    </div>
  );
};

export default ActionManagerTab;
