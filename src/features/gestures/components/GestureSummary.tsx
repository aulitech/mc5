// GestureSummary.tsx — Shows saved gesture classes and their individual recordings.
//
// Clicking a class chooses it as the gesture to record (the viewer goes live,
// with Record over it); its disclosure arrow shows or hides its recordings.
// "New gesture" names a new one. Classes are listed in the user's order —
// dragged by their handles (or moved with ↑/↓ on a focused handle) — else in
// the order they were created; never alphabetically. From the list the user
// can also:
//   • Click a recording to load it in the 3D visualizer (its target pane)
//   • Delete a single recording
//   • Rename or delete the entire class (all recordings)
//   • Check classes / standard gestures for model generation

import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { useState, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import { useDialog } from "../../../context/DialogContext";
import { errorMessage, notify } from "../../../lib/notify";
import type { Recording } from "../../../types/gestures";
import { STANDARD_GESTURES } from "../data/standardGestures";
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
  // Drag to reorder: a handle starts the drag; each class row is a drop
  // target, and the drop lands before or after it by which half the pointer
  // is over.
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<{ name: string; after: boolean } | null>(null);

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

  const handleDragStart = (e: DragEvent<HTMLElement>, name: string) => {
    setDragging(name);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", name);
    const row = e.currentTarget.closest("li");
    if (row) e.dataTransfer.setDragImage(row, 12, 12); // drag the whole row, not just the handle
  };

  const handleDragOver = (e: DragEvent<HTMLLIElement>, name: string) => {
    if (!dragging) return;
    e.preventDefault(); // allow a drop here
    e.dataTransfer.dropEffect = "move";
    const { top, height } = e.currentTarget.getBoundingClientRect();
    const after = e.clientY > top + height / 2;
    if (dropAt?.name !== name || dropAt.after !== after) setDropAt({ name, after });
  };

  const endDrag = () => {
    setDragging(null);
    setDropAt(null);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    if (dragging && dropAt && dropAt.name !== dragging) {
      const order = store.gestureOrder;
      let to = order.indexOf(dropAt.name) + (dropAt.after ? 1 : 0);
      if (order.indexOf(dragging) < to) to -= 1; // it leaves its old place first
      store.moveGesture(dragging, to);
    }
    endDrag();
  };

  // ↑/↓ on a focused handle moves its class one place.
  const handleHandleKey = (e: KeyboardEvent, name: string) => {
    const delta = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (delta === 0) return;
    e.preventDefault();
    store.moveGesture(name, store.gestureOrder.indexOf(name) + delta);
  };

  const handleNewGesture = async () => {
    const name = (await prompt("Name the new gesture:"))?.trim();
    if (name) store.selectGesture(name);
  };

  const handleDeleteClass = async (e: MouseEvent, name: string) => {
    e.stopPropagation(); // don't also choose the gesture
    if (!(await confirm(`Delete all recordings for "${name}"?`))) return;
    await store.deleteClass(name);
    replaceExpanded(name);
  };

  const handleRenameClass = async (e: MouseEvent, name: string) => {
    e.stopPropagation(); // don't also choose the gesture
    const newName = (await prompt("Rename gesture:", name))?.trim();
    if (!newName || newName === name) return;
    if (store.counts[newName] && !(await confirm(`"${newName}" already exists. Merge "${name}" into it?`))) return;
    await store.renameClass(name, newName);
    replaceExpanded(name, newName);
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
  const isShown = (kind: "recording" | "standard", id: number | string) =>
    store.views.some((v) => v?.kind === kind && v.id === id);
  const entries = store.gestureOrder.filter((name) => name in store.counts).map((name) => [name, store.counts[name]] as const);
  // A newly named gesture has no recordings (and no class) until its first
  // take is saved; it's shown at the end, where it will be added.
  const pending = store.activeGesture !== null && !(store.activeGesture in store.counts) ? store.activeGesture : null;

  return (
    <div className={styles.summary}>
      <button className={styles.btn} onClick={handleNewGesture}>
        New gesture
      </button>

      {entries.length === 0 && !pending && (
        <p className={styles.emptyMsg}>No recordings yet. Choose New gesture to record one.</p>
      )}

      <ul className={styles.summaryList}>
        {entries.map(([name, count]) => {
          const recordings = store.recordings[name];
          const expanded = expandedClasses.has(name);
          const dropClass = dropAt?.name === name && dragging !== name ? (dropAt.after ? styles.dropAfter : styles.dropBefore) : "";
          return (
            <li
              key={name}
              className={`${styles.classGroup} ${dropClass} ${dragging === name ? styles.dragging : ""}`}
              onDragOver={(e) => handleDragOver(e, name)}
              onDrop={handleDrop}
            >
              {/* ── Class header row ── */}
              <div
                className={`${styles.summaryItem} ${name === store.activeGesture ? styles.selected : ""}`}
                onClick={() => store.selectGesture(name)}
                title="Click to record this gesture"
              >
                <button
                  className={`btn-plain ${styles.dragHandle}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, name)}
                  onDragEnd={endDrag}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => handleHandleKey(e, name)}
                  aria-label={`Move "${name}" (drag, or use the up and down arrow keys)`}
                  title="Drag to reorder"
                >
                  <GripVertical size={16} />
                </button>
                <button
                  className={`btn-plain ${styles.disclosure} ${expanded ? styles.disclosureOpen : ""}`}
                  onClick={(e) => handleToggleExpanded(e, name)}
                  aria-expanded={expanded}
                  aria-label={`${expanded ? "Hide" : "Show"} "${name}" recordings`}
                  title={`${expanded ? "Hide" : "Show"} recordings`}
                >
                  <DisclosureTriangle />
                </button>
                <input
                  type="checkbox"
                  className={styles.templateCheckbox}
                  checked={store.checkedClasses.has(name)}
                  onChange={() => store.toggleClass(name)}
                  onClick={(e) => e.stopPropagation()}
                  title="Select for template generation"
                  aria-label={`Include ${name} in the next model`}
                />
                <span className={styles.gestureCount}>{count}</span>
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
                    title={`Delete all "${name}" recordings`}
                    aria-label={`Delete all "${name}" recordings`}
                  >
                    <Trash2 size={16} color="var(--danger)" />
                  </button>
                </span>
              </div>

              {/* ── Expanded recordings list ── */}
              {expanded && (
                <ul className={styles.recordingList}>
                  {!recordings && <li className={styles.emptyMsg}>Loading…</li>}
                  {recordings?.length === 0 && <li className={styles.emptyMsg}>No recordings found.</li>}
                  {recordings?.map((rec) => (
                    <li
                      key={rec.id}
                      className={`${styles.recordingItem} ${isShown("recording", rec.id) ? styles.active : ""}`}
                      onClick={() => store.selectRecording(rec)}
                      title="Click to visualize this recording"
                    >
                      <button
                        className={`btn-plain ${styles.recordingMeta}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          store.selectRecording(rec);
                        }}
                        aria-pressed={isShown("recording", rec.id)}
                      >
                        {fmtTime(rec.timestamp)}
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
                  {pending && (
          <li className={styles.classGroup}>
            <div className={`${styles.summaryItem} ${styles.selected}`}>
              {/* Nothing to drag or show until its first take is saved */}
              <span className={styles.dragHandle} aria-hidden="true" />
              <span className={styles.disclosure} aria-hidden="true" />
              <span className={styles.gestureCount}>0</span>
              <span className={styles.gestureName}>{pending}</span>
            </div>
          </li>
        )}
      </ul>
              )}
            </li>
          );
        })}
      </ul>

      {/* ── Standard gestures ── */}
      <div className={styles.standardDivider} />
      <h4 className={styles.standardGesturesHeading}>Standard Gestures</h4>
      <ul className={`${styles.summaryList} ${styles.standardList}`}>
        {STANDARD_GESTURES.map((g) => (
          <li key={g.id} className={styles.classGroup}>
            <div
              className={`${styles.summaryItem} ${isShown("standard", g.id) ? styles.selected : ""}`}
              onClick={() => store.selectStandard(g.id)}
              title="Click to visualize this gesture"
            >
              <input
                type="checkbox"
                className={styles.templateCheckbox}
                checked={store.checkedStandards.has(g.id)}
                onChange={() => store.toggleStandard(g.id)}
                onClick={(e) => e.stopPropagation()}
                title="Select for template generation"
                aria-label={`Include ${g.label} in the next model`}
              />
              <button
                className={`btn-plain ${styles.gestureName}`}
                onClick={(e) => {
                  e.stopPropagation();
                  store.selectStandard(g.id);
                }}
                aria-pressed={isShown("standard", g.id)}
              >
                {g.label}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* ── Recordings files ── */}
      <div className={styles.standardDivider} />
      <h4 className={styles.standardGesturesHeading}>Recordings</h4>
      <div className={styles.recordingFileActions}>
        <button
          className={styles.btn}
          onClick={handleImport}
          title="Add recordings from files exported by MyCato"
          aria-label="Import recordings"
        >
          Import…
        </button>
        <button
          className={styles.btn}
          onClick={handleExport}
          aria-label="Export recordings"
          disabled={entries.length === 0}
          title="Save every recording to one file, to back them up or import elsewhere"
        >
          Export…
        </button>
      </div>
    </div>
  );
}

export default GestureSummary;
