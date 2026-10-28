// GestureStoreProvider — In-memory view of the gesture IndexedDB plus the
// Gestures tab's selection state. Every mutation writes to IndexedDB first,
// then refreshes only what it changed, so components never need to be told
// to "refetch".

import { useEffect, useState, type ReactNode } from "react";
import { errorMessage, notify } from "../../../lib/notify";
import type { GestureModel, ModelGesture, Recording, Sample } from "../../../types/gestures";
import * as db from "../data/gestureDB";
import { STANDARD_GESTURES, loadStandardGestureTemplate, templateToSamples } from "../data/standardGestures";
import { buildTemplateWithOutlierRejection, preprocessRecording } from "../lib/templateGen";
import { GestureStoreContext, type GestureStore, type VisualizerSelection } from "./GestureStoreContext";

const fail = (action: string) => (err: unknown) => {
  console.error(`Gestures: failed to ${action}`, err);
  notify.error(`Couldn't ${action}: ${errorMessage(err)}`);
};

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
  const [selection, setSelection] = useState<VisualizerSelection | null>(null);
  const [checkedClasses, setCheckedClasses] = useState<Set<string>>(() => new Set());
  const [checkedStandards, setCheckedStandards] = useState<Set<string>>(() => new Set());
  const [models, setModels] = useState<GestureModel[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    db.getGestureCounts().then(setCounts).catch(fail("load saved gestures"));
    db.getAllModels().then(setModels).catch(fail("load saved models"));
  }, []);

  const refreshCounts = () => db.getGestureCounts().then(setCounts);

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
    counts,
    recordings,

    loadRecordings: (gestureName) => reloadClass(gestureName).catch(fail("load recordings")),

    addRecording: async (gestureName, samples) => {
      try {
        const id = await db.saveRecording(gestureName, samples);
        await Promise.all([refreshCounts(), reloadClass(gestureName)]);
        setSelection({ kind: "recording", id, gestureName, samples });
      } catch (err) {
        fail("save the recording")(err);
      }
    },

    deleteRecording: async (recording) => {
      try {
        await db.deleteRecording(recording.id);
        await Promise.all([refreshCounts(), reloadClass(recording.gestureName)]);
        setSelection((sel) => (sel?.kind === "recording" && sel.id === recording.id ? null : sel));
      } catch (err) {
        fail("delete the recording")(err);
      }
    },

    deleteClass: async (gestureName) => {
      try {
        await db.deleteGesture(gestureName);
        dropClass(gestureName);
        setCheckedClasses((prev) => without(prev, gestureName));
        setSelection((sel) =>
          sel?.kind === "recording" && sel.gestureName === gestureName ? null : sel,
        );
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
        setSelection((sel) =>
          sel?.kind === "recording" && sel.gestureName === oldName ? { ...sel, gestureName: newName } : sel,
        );
        await Promise.all([refreshCounts(), reloadClass(newName)]);
      } catch (err) {
        fail(`rename "${oldName}"`)(err);
      }
    },

    selection,

    selectRecording: (recording) =>
      setSelection({
        kind: "recording",
        id: recording.id,
        gestureName: recording.gestureName,
        samples: recording.data,
      }),

    selectStandard: async (id) => {
      try {
        const template = await loadStandardGestureTemplate(id);
        setSelection({ kind: "standard", id, samples: templateToSamples(template) });
      } catch (err) {
        fail("load the standard gesture")(err);
      }
    },

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
