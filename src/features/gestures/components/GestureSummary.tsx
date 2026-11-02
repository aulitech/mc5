// GestureSummary.tsx — Shows saved gesture classes and their individual recordings.
//
// Clicking a class chooses it as the gesture to record (the viewer goes live,
// with Record over it); its disclosure arrow shows or hides its recordings.
// "+" (below the list) names a new one. Classes are listed in
// the order they were created (see lib/gestureOrder); never alphabetically.
// From the list the user can also:
//   • Click a recording to load it in the 3D visualizer (its target pane)
//   • Delete a single recording
//   • Rename or delete a gesture (with all its recordings) — deleting its
//     recordings one by one leaves the gesture in the list
// The model's gestures are chosen in the Model section.

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { useDialog } from "../../../context/DialogContext";
import { errorMessage, notify } from "../../../lib/notify";
import type { Recording } from "../../../types/gestures";
import { fmtTime } from "../lib/format";
import { exportRecordings, openRecordingFiles } from "../lib/recordingFile";
import { useGestureStore } from "../state/GestureStoreContext";
import DisclosureTriangle from "./DisclosureTriangle";
import styles from "../GestureTab.module.css";

function GestureSummary() {
  const store = useGestureStore();
  const { confirm, prompt } = useDialog();
  // Every class currently showing its recordings list — any number can be
  // open at once.
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(() => new Set());

  const replaceExpanded = (from: string, to?: string) =>
    setExpandedClasses((prev) => {
      if (!prev.has(from)) return prev;
      const next = new Set(prev);
      next.delete(from);
      if (to) next.add(to);
      return next;
    });

  const handleToggleExpanded = (e: MouseEvent, name: string) => {
    e.stopPropagation(); // showing recordings doesn't choose the gesture
    if (expandedClasses.has(name)) {
      replaceExpanded(name);
    } else {
      setExpandedClasses((prev) => new Set(prev).add(name));
      store.loadRecordings(name);
    }
  };

  const handleDeleteClass = async (e: MouseEvent, name: string) => {
    e.stopPropagation(); // don't also choose the gesture
    if (!(await confirm(`Delete "${name}" and all its recordings?`))) return;
    await store.deleteClass(name);
    replaceExpanded(name);
  };

  const handleRenameClass = async (e: MouseEvent, name: string) => {
    e.stopPropagation(); // don't also choose the gesture
    const newName = (await prompt("Rename gesture:", name))?.trim();
    if (!newName || newName === name) return;
    if (newName in store.counts && !(await confirm(`"${newName}" already exists. Merge "${name}" into it?`))) return;
    await store.renameClass(name, newName);
    replaceExpanded(name, newName);
  };

  const handleNewGesture = async () => {
    const name = (await prompt("Name the new gesture:"))?.trim();
    if (name) await store.addGesture(name);
  };

  const handleImport = async () => {
    try {
      const imported = await openRecordingFiles();
      if (imported.length > 0) await store.importRecordings(imported);
    } catch (err) {
      notify.error(errorMessage(err));
    }
  };

  const handleExport = () =>
    exportRecordings().catch((err) => notify.error(`Couldn't export: ${errorMessage(err)}`));

  const handleDeleteRecording = (e: MouseEvent, rec: Recording) => {
    e.stopPropagation();
    store.deleteRecording(rec);
  };

  // Highlight whatever is showing in any pane.
  const isShown = (id: number) => store.views.some((v) => v.kind === "recording" && v.id === id);
  const entries = store.gestureOrder.filter((name) => name in store.counts).map((name) => [name, store.counts[name]] as const);

  return (
    <div className={styles.summary}>
      {entries.length === 0 && (
        <p className={styles.emptyMsg}>No gestures yet. Click + to add one.</p>
      )}

      <ul className={styles.summaryList}>
        {entries.map(([name, count]) => {
          const recordings = store.recordings[name];
          const expanded = expandedClasses.has(name);
          return (
            <li key={name} className={styles.classGroup}>
              {/* ── Class header row ── */}
              <div
                className={`${styles.summaryItem} ${name === store.activeGesture ? styles.selected : ""}`}
                onClick={() => store.selectGesture(name)}
                title="Click to record this gesture"
              >
                <button
                  className={`btn-plain ${styles.disclosure} ${expanded ? styles.disclosureOpen : ""}`}
                  onClick={(e) => handleToggleExpanded(e, name)}
                  aria-expanded={expanded}
                  aria-label={`${expanded ? "Hide" : "Show"} "${name}" recordings`}
                  title={`${expanded ? "Hide" : "Show"} recordings`}
                >
                  <DisclosureTriangle />
                </button>
                <button
                  className={`btn-plain ${styles.gestureName}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    store.selectGesture(name);
                  }}
                  aria-current={name === store.activeGesture ? "true" : undefined}
                >
                  {name}
                </button>
                <span className={styles.gestureCount}>{count}</span>
                <span className={styles.rowActions}>
                  <button
                    className="btn-ghost"
                    onClick={(e) => handleRenameClass(e, name)}
                    title={`Rename "${name}"`}
                    aria-label={`Rename "${name}"`}
                  >
                    <Pencil size={16} color="var(--success)" />
                  </button>
                  <button
                    className="btn-ghost btn-danger"
                    onClick={(e) => handleDeleteClass(e, name)}
                    title={`Delete "${name}" and its recordings`}
                    aria-label={`Delete "${name}" and its recordings`}
                  >
                    <Trash2 size={16} color="var(--danger)" />
                  </button>
                </span>
              </div>

              {/* ── Expanded recordings list ── */}
              {expanded && (
                <ul className={styles.recordingList}>
                  {!recordings && <li className={styles.emptyMsg}>Loading…</li>}
                  {recordings?.length === 0 && <li className={styles.emptyMsg}>No recordings yet.</li>}
                  {recordings?.map((rec) => (
                    <li
                      key={rec.id}
                      className={`${styles.recordingItem} ${isShown(rec.id) ? styles.active : ""}`}
                      onClick={() => store.selectRecording(rec)}
                      title="Click to visualize this recording"
                    >
                      <button
                        className={`btn-plain ${styles.recordingMeta}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          store.selectRecording(rec);
                        }}
                        aria-pressed={isShown(rec.id)}
                      >
                        {fmtTime(rec.timestamp)} <span className={styles.sampleCount}>n={rec.data.length}</span>
                      </button>
                      <button
                        className="btn-ghost btn-danger"
                        onClick={(e) => handleDeleteRecording(e, rec)}
                        title="Delete this recording"
                        aria-label={`Delete recording from ${fmtTime(rec.timestamp)}`}
                      >
                        <Trash2 size={16} color="var(--danger)" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {/* Name a new gesture: it's added to the list, with no recordings, and chosen for recording. */}
      <button
        className={`btn-primary ${styles.addBtn}`}
        onClick={handleNewGesture}
        title="Add a gesture"
        aria-label="Add a gesture"
      >
        <Plus size={16} aria-hidden="true" />
      </button>

      {/* Recordings files */}
      <div className={styles.recordingFileActions}>
        <button
          className={styles.btn}
          onClick={handleImport}
          title="Add recordings from files exported by MyCato"
          aria-label="Import recordings"
        >
          Import
        </button>
        <button
          className={styles.btn}
          onClick={handleExport}
          aria-label="Export recordings"
          disabled={entries.length === 0}
          title="Save every recording to one file, to back them up or import elsewhere"
        >
          Export
        </button>
      </div>
    </div>
  );
}

export default GestureSummary;
