// GestureStoreProvider — In-memory view of the gesture IndexedDB plus the
// Gestures tab's visualizer state. Every mutation writes to IndexedDB first,
// then refreshes only what it changed, so components never need to be told
// to "refetch".

import { useEffect, useState, type ReactNode } from "react";
import { errorMessage, notify } from "../../../lib/notify";
import type { GestureModel, ModelGesture, Recording, Sample } from "../../../types/gestures";
import * as db from "../data/gestureDB";
import { STANDARD_GESTURES, loadStandardGestureTemplate, templateToSamples } from "../data/standardGestures";
import { recordingKey } from "../lib/recordingFile";
import { buildTemplateWithOutlierRejection, preprocessRecording } from "../lib/templateGen";
import { GestureStoreContext, VIEW_COUNT, type GestureStore, type ViewSource } from "./GestureStoreContext";

const fail = (action: string) => (err: unknown) => {
  console.error(`Gestures: failed to ${action}`, err);
  notify.error(`Couldn't ${action}: ${errorMessage(err)}`);
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const toggled = <T,>(set: Set<T>, item: T) => {
  const next = new Set(set);
  if (next.has(item)) next.delete(item);
  else next.add(item);
  return next;
};

const without = <T,>(set: Set<T>, item: T) => {
  if (!set.has(item)) return set;
  const next = new Set(set);
  next.delete(item);
  return next;
};

export const GestureStoreProvider = ({ children }: { children: ReactNode }) => {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [recordings, setRecordings] = useState<Record<string, Recording[]>>({});
  const [views, setViews] = useState<(ViewSource | null)[]>(() => Array(VIEW_COUNT).fill(null));
  const [compare, setCompareState] = useState(false);
  const [targetView, setTargetView] = useState(0);
  const [activeGesture, setActiveGesture] = useState<string | null>(null);
  const [slowMotion, setSlowMotion] = useState(false);
  const [checkedClasses, setCheckedClasses] = useState<Set<string>>(() => new Set());
  const [checkedStandards, setCheckedStandards] = useState<Set<string>>(() => new Set());
  const [models, setModels] = useState<GestureModel[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    db.getGestureCounts().then(setCounts).catch(fail("load saved gestures"));
    db.getAllModels().then(setModels).catch(fail("load saved models"));
  }, []);

  const refreshCounts = () => db.getGestureCounts().then(setCounts);

  // Put a source in the target pane. Live shows in one pane at most, so
  // showing it here clears it from the other.
  const showInTarget = (source: ViewSource | null) =>
    setViews((prev) =>
      prev.map((v, i) => (i === targetView ? source : source?.kind === "live" && v?.kind === "live" ? null : v)),
    );

  // Apply `fn` to every pane, e.g. to drop or relabel a deleted/renamed recording.
  const updateViews = (fn: (v: ViewSource | null) => ViewSource | null) =>
    setViews((prev) => {
      const next = prev.map(fn);
      return next.every((v, i) => v === prev[i]) ? prev : next;
    });

  const reloadClass = async (gestureName: string) => {
    const recs = await db.getRecordingsForGesture(gestureName);
    setRecordings((prev) => ({ ...prev, [gestureName]: [...recs].sort((a, b) => b.id - a.id) }));
  };

  const dropClass = (gestureName: string) =>
    setRecordings((prev) => {
      const next = { ...prev };
      delete next[gestureName];
      return next;
    });

  const store: GestureStore = {
    activeGesture,
    selectGesture: (gestureName) => {
      setActiveGesture(gestureName);
      setCompareState(false);
      setTargetView(0);
      setViews((prev) => prev.map((_, i) => (i === 0 ? { kind: "live" } : null)));
      setSlowMotion(false);
    },

    counts,
    recordings,

    loadRecordings: (gestureName) => reloadClass(gestureName).catch(fail("load recordings")),

    addRecording: async (gestureName, samples) => {
      try {
        await db.saveRecording(gestureName, samples);
        await Promise.all([refreshCounts(), reloadClass(gestureName)]);
        // The viewer stays live, ready for the next take.
        return true;
      } catch (err) {
        fail("save the recording")(err);
        return false;
      }
    },

    deleteRecording: async (recording) => {
      try {
        await db.deleteRecording(recording.id);
        await Promise.all([refreshCounts(), reloadClass(recording.gestureName)]);
        updateViews((v) => (v?.kind === "recording" && v.id === recording.id ? null : v));
      } catch (err) {
        fail("delete the recording")(err);
      }
    },

    deleteClass: async (gestureName) => {
      try {
        await db.deleteGesture(gestureName);
        dropClass(gestureName);
        setCheckedClasses((prev) => without(prev, gestureName));
        updateViews((v) => (v?.kind === "recording" && v.gestureName === gestureName ? null : v));
        await refreshCounts();
      } catch (err) {
        fail(`delete "${gestureName}"`)(err);
      }
    },

    renameClass: async (oldName, newName) => {
      try {
        await db.renameGesture(oldName, newName);
        dropClass(oldName);
        setCheckedClasses((prev) => (prev.has(oldName) ? new Set(without(prev, oldName)).add(newName) : prev));
        updateViews((v) => (v?.kind === "recording" && v.gestureName === oldName ? { ...v, gestureName: newName } : v));
        setActiveGesture((name) => (name === oldName ? newName : name));
        await Promise.all([refreshCounts(), reloadClass(newName)]);
      } catch (err) {
        fail(`rename "${oldName}"`)(err);
      }
    },

    importRecordings: async (imported) => {
      try {
        const stored = new Set((await db.getAllRecordings()).map(recordingKey));
        const fresh = imported.filter((r) => {
          const key = recordingKey(r);
          if (stored.has(key)) return false;
          stored.add(key); // also drops repeats within the import
          return true;
        });
        if (fresh.length > 0) await db.addRecordings(fresh);
        // Refresh the counts, and any open class lists that gained recordings.
        const changed = new Set(fresh.map((r) => r.gestureName));
        await Promise.all([refreshCounts(), ...[...changed].filter((n) => n in recordings).map(reloadClass)]);

        const skipped = imported.length - fresh.length;
        if (fresh.length === 0) {
          notify.info(`Nothing new: ${skipped === 1 ? "that recording is" : `all ${skipped} recordings are`} already here.`);
        } else {
          notify.success(
            `Imported ${plural(fresh.length, "recording")} of ${plural(changed.size, "gesture")}.` +
              (skipped > 0 ? ` Skipped ${skipped} already here.` : ""),
          );
        }
      } catch (err) {
        fail("import the recordings")(err);
      }
    },

    views,
    compare,
    setCompare: (on) => {
      setCompareState(on);
      // Comparing starts by filling the new right-hand pane; leaving it
      // empties that pane so it doesn't replay hidden.
      setTargetView(on ? 1 : 0);
      if (!on) setViews((prev) => prev.map((v, i) => (i === 0 ? v : null)));
    },
    targetView,
    setTargetView,

    selectRecording: (recording) =>
      showInTarget({
        kind: "recording",
        id: recording.id,
        gestureName: recording.gestureName,
        timestamp: recording.timestamp,
        samples: recording.data,
      }),

    selectStandard: async (id) => {
      try {
        const template = await loadStandardGestureTemplate(id);
        showInTarget({ kind: "standard", id, samples: templateToSamples(template) });
      } catch (err) {
        fail("load the standard gesture")(err);
      }
    },

    toggleLive: () => showInTarget(views[targetView]?.kind === "live" ? null : { kind: "live" }),
    slowMotion,
    setSlowMotion,

    checkedClasses,
    toggleClass: (gestureName) => setCheckedClasses((prev) => toggled(prev, gestureName)),
    checkedStandards,
    toggleStandard: (id) => setCheckedStandards((prev) => toggled(prev, id)),

    models,
    isGenerating,

    generateModel: async (modelName) => {
      setIsGenerating(true);
      const gestures: Record<string, ModelGesture> = {};
      const skipped: string[] = [];
      const clashes: string[] = [];

      for (const gestureName of checkedClasses) {
        try {
          const recs = await db.getRecordingsForGesture(gestureName);
          const preprocessed = recs
            .map((r) => preprocessRecording(r.data))
            .filter((r): r is Sample[] => r !== null);
          const { template, keptCount, totalCount } = buildTemplateWithOutlierRejection(preprocessed);
          if (template) gestures[gestureName] = { template, keptCount, totalCount };
          else skipped.push(gestureName);
        } catch (err) {
          console.error(`Gestures: template generation failed for "${gestureName}"`, err);
          skipped.push(gestureName);
        }
      }

      // Standard gestures already have a finished template — no recordings to
      // build one from, so just load and attach it directly.
      for (const id of checkedStandards) {
        const label = STANDARD_GESTURES.find((g) => g.id === id)?.label ?? id;
        // A model's classes are keyed by name; don't let a standard gesture
        // silently replace a recorded class that has the same one.
        if (gestures[label]) {
          clashes.push(label);
          continue;
        }
        try {
          const template = await loadStandardGestureTemplate(id);
          gestures[label] = { template, keptCount: 1, totalCount: 1 };
        } catch (err) {
          console.error(`Gestures: failed to load standard gesture "${id}"`, err);
          skipped.push(label);
        }
      }

      if (skipped.length > 0) {
        notify.error(
          `Left out of the model: ${skipped.join(", ")}. Recordings need the whole gesture inside the capture window.`,
        );
      }
      if (clashes.length > 0) {
        notify.error(
          `Standard ${clashes.join(", ")} left out: a recorded gesture already has that name. Rename one to include both.`,
        );
      }

      try {
        if (Object.keys(gestures).length > 0) {
          const model = await db.saveModel(modelName, gestures);
          setModels((prev) => [...prev, model]);
          setCheckedClasses(new Set());
          setCheckedStandards(new Set());
        }
      } catch (err) {
        fail("save the model")(err);
      } finally {
        setIsGenerating(false);
      }
    },

    deleteModel: async (id) => {
      try {
        await db.deleteModel(id);
        setModels((prev) => prev.filter((m) => m.id !== id));
      } catch (err) {
        fail("delete the model")(err);
      }
    },
  };

  return <GestureStoreContext.Provider value={store}>{children}</GestureStoreContext.Provider>;
};
