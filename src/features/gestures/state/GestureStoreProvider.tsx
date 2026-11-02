// GestureStoreProvider — In-memory view of the gesture IndexedDB plus the
// Gestures tab's visualizer state. Every mutation writes to IndexedDB first,
// then refreshes only what it changed, so components never need to be told
// to "refetch".

import { useEffect, useState, type ReactNode } from "react";
import { useDevice } from "../../../context/DeviceContext";
import { errorMessage, notify } from "../../../lib/notify";
import type { ModelSlot, Recording, Template } from "../../../types/gestures";
import * as db from "../data/gestureDB";
import { loadSlotTemplate } from "../data/slotTemplates";
import { STANDARD_GESTURES, loadStandardGestureTemplate, templateToSamples } from "../data/standardGestures";
import { orderGestures, renameIn } from "../lib/gestureOrder";
import { MODEL_SLOTS, renamePersonal, setSlot, slotLabel, slotsFromCato, slotsFromDevice, validSlots } from "../lib/modelSlots";
import { recordingKey, type RecordingData } from "../lib/recordingFile";
import { GestureStoreContext, LIVE, VIEW_COUNT, type GestureStore, type ViewSource } from "./GestureStoreContext";

const fail = (action: string) => (err: unknown) => {
  console.error(`Gestures: failed to ${action}`, err);
  notify.error(`Couldn't ${action}: ${errorMessage(err)}`);
};

const saveOrder = (order: string[]) => db.saveGestureOrder(order).catch(fail("save the gesture order"));

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const recordingView = (recording: Recording): ViewSource => ({
  kind: "recording",
  id: recording.id,
  gestureName: recording.gestureName,
  timestamp: recording.timestamp,
  samples: recording.data,
});

/** What a pane shows for a choice: a personal gesture's newest recording (null if it has none) or a pretrained gesture. */
async function loadView(choice: ModelSlot): Promise<ViewSource | null> {
  if (choice.kind === "pretrained") {
    const template = await loadStandardGestureTemplate(choice.id);
    return { kind: "standard", id: choice.id, samples: templateToSamples(template) };
  }
  const recs = await db.getRecordingsForGesture(choice.name);
  const newest = recs.reduce<Recording | null>((a, r) => (a && a.id > r.id ? a : r), null);
  return newest && recordingView(newest);
}

/**
 * What the right-hand pane shows when it has nothing to (it's never Live):
 * the gesture being recorded, else the model's first gesture, else the first
 * pretrained one. Null if none of them loads.
 */
async function loadCompareView(
  activeGesture: string | null,
  counts: Record<string, number>,
  modelSlots: ModelSlot[],
): Promise<ViewSource | null> {
  const choices: ModelSlot[] = [
    ...(activeGesture && counts[activeGesture] > 0 ? [{ kind: "personal", name: activeGesture } as const] : []),
    ...modelSlots.slice(0, 1),
    { kind: "pretrained", id: STANDARD_GESTURES[0].id },
  ];
  for (const choice of choices) {
    const view = await loadView(choice).catch(() => null);
    if (view) return view;
  }
  return null;
}

export const GestureStoreProvider = ({ children }: { children: ReactNode }) => {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [gestureOrder, setGestureOrder] = useState<string[]>([]);
  const [positionResets, setPositionResets] = useState(0);
  const [recordings, setRecordings] = useState<Record<string, Recording[]>>({});
  const [views, setViews] = useState<ViewSource[]>(() => Array(VIEW_COUNT).fill(LIVE));
  const [compare, setCompareState] = useState(false);
  const [targetView, setTargetView] = useState(0);
  const [activeGesture, setActiveGesture] = useState<string | null>(null);
  const [slowMotion, setSlowMotion] = useState(false);
  const [modelSlots, setModelSlots] = useState<ModelSlot[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Counts and list together, so the list never shows a gesture without its
  // count (0 for one with no recordings). Every gesture with recordings is
  // saved in the list, so it stays there if they're all deleted.
  const showClasses = (classes: db.GestureClassInfo[], savedOrder: string[]) => {
    const order = orderGestures(savedOrder, classes);
    const recorded = Object.fromEntries(classes.map((c) => [c.name, c.count]));
    setCounts(Object.fromEntries(order.map((name) => [name, recorded[name] ?? 0])));
    setGestureOrder(order);
    if (order.join("\n") !== savedOrder.join("\n")) saveOrder(order);
  };

  const refreshCounts = async () => {
    const [classes, savedOrder] = await Promise.all([db.getGestureClasses(), db.getGestureOrder()]);
    showClasses(classes, savedOrder);
  };

  // The slots start as the model installed on the device (its gesture_list),
  // each time the device reports a list they weren't last set from — on
  // connecting, or after a new model is installed. Otherwise they're as saved.
  const { gestureNames } = useDevice();
  useEffect(() => {
    Promise.all([db.getGestureClasses(), db.getGestureOrder(), db.getModelSlots(), db.getSlotsFromDevice()])
      .then(([classes, savedOrder, savedSlots, setFrom]) => {
        showClasses(classes, savedOrder);
        const recorded = classes.map((c) => c.name);
        const isNew = gestureNames.length > 0 && gestureNames.join("\n") !== setFrom.join("\n");
        if (!isNew) {
          // The saved slots, less any whose gesture has been deleted.
          setModelSlots(validSlots(savedSlots, orderGestures(savedOrder, classes)));
          return;
        }
        const { slots, unknown } = slotsFromDevice(gestureNames, recorded);
        setModelSlots(slots);
        db.saveModelSlots(slots, gestureNames).catch(fail("save the model's gestures"));
        if (unknown.length > 0) {
          notify.info(
            `Cato's model has ${unknown.join(", ")}, not a personal or pretrained gesture here, ` +
              `so ${unknown.length === 1 ? "it's" : "they're"} left out of the slots.`,
          );
        }
      })
      .catch(fail("load saved gestures"));
  }, [gestureNames]);

  // What the slots are reset to (see slotsFromDevice).
  const recorded = gestureOrder.filter((name) => counts[name] > 0);
  const deviceSlots = gestureNames.length > 0 ? slotsFromDevice(gestureNames, recorded).slots : null;

  const updateSlots = (fn: (slots: ModelSlot[]) => ModelSlot[]) => {
    const next = fn(modelSlots);
    setModelSlots(next);
    db.saveModelSlots(next).catch(fail("save the model's gestures"));
  };

  const showIn = (index: number, source: ViewSource) =>
    setViews((prev) => prev.map((v, i) => (i === index ? source : v)));

  // Apply `fn` to every pane, e.g. to drop or relabel a deleted/renamed recording.
  const updateViews = (fn: (v: ViewSource, index: number) => ViewSource) =>
    setViews((prev) => {
      const next = prev.map(fn);
      return next.every((v, i) => v === prev[i]) ? prev : next;
    });

  /** Reload a gesture's recordings, newest first, and return them. */
  const reloadClass = async (gestureName: string) => {
    const recs = [...(await db.getRecordingsForGesture(gestureName))].sort((a, b) => b.id - a.id);
    setRecordings((prev) => ({ ...prev, [gestureName]: recs }));
    return recs;
  };

  // What replaces the right-hand pane's gesture when it's deleted, since that
  // pane is never Live.
  const compareFallback = () => loadCompareView(activeGesture, counts, modelSlots);
  const rightShows = (match: (v: ViewSource) => boolean) => views.slice(1).some(match);

  // Should the right-hand pane still end up with nothing to show, it gets
  // something else.
  useEffect(() => {
    if (!compare || views[1]?.kind !== "live") return;
    let cancelled = false;
    loadCompareView(activeGesture, counts, modelSlots).then((view) => {
      if (cancelled) return;
      if (view) setViews((prev) => prev.map((v, i) => (i === 1 ? view : v)));
      else setCompareState(false);
    });
    return () => {
      cancelled = true;
    };
  }, [compare, views, activeGesture, counts, modelSlots]);

  const dropClass = (gestureName: string) =>
    setRecordings((prev) => {
      const next = { ...prev };
      delete next[gestureName];
      return next;
    });

  // Add imported recordings, skipping any already stored. False (after
  // notifying) if they couldn't be added.
  const importRecordings = async (imported: RecordingData[]) => {
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
      return true;
    } catch (err) {
      fail("import the recordings")(err);
      return false;
    }
  };

  const store: GestureStore = {
    activeGesture,
    addGesture: async (gestureName) => {
      if (!gestureOrder.includes(gestureName)) {
        await saveOrder([...gestureOrder, gestureName]);
        await refreshCounts().catch(fail("load saved gestures"));
      }
      store.selectGesture(gestureName);
    },

    selectGesture: (gestureName) => {
      setActiveGesture(gestureName);
      setCompareState(false);
      setTargetView(0);
      setViews((prev) => prev.map(() => LIVE));
      setSlowMotion(false);
    },

    counts,
    gestureOrder,
    recordings,

    loadRecordings: async (gestureName) => {
      await reloadClass(gestureName).catch(fail("load recordings"));
    },

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
        const [, remaining] = await Promise.all([refreshCounts(), reloadClass(recording.gestureName)]);
        // A pane showing it goes Live; the right-hand one, which can't, shows
        // the gesture's newest recording left, or failing that a fallback.
        const shown = (v: ViewSource) => v.kind === "recording" && v.id === recording.id;
        const replacement = remaining[0]
          ? recordingView(remaining[0])
          : rightShows(shown)
            ? await compareFallback()
            : null;
        updateViews((v, i) => (shown(v) ? (i > 0 && replacement ? replacement : LIVE) : v));
      } catch (err) {
        fail("delete the recording")(err);
      }
    },

    deleteClass: async (gestureName) => {
      try {
        await db.deleteGesture(gestureName);
        await saveOrder(gestureOrder.filter((n) => n !== gestureName));
        dropClass(gestureName);
        updateSlots((slots) => renamePersonal(slots, gestureName, null));
        const shown = (v: ViewSource) => v.kind === "recording" && v.gestureName === gestureName;
        const replacement = rightShows(shown) ? await compareFallback() : null;
        updateViews((v, i) => (shown(v) ? (i > 0 && replacement ? replacement : LIVE) : v));
        await refreshCounts();
      } catch (err) {
        fail(`delete "${gestureName}"`)(err);
      }
    },

    renameClass: async (oldName, newName) => {
      try {
        await db.renameGesture(oldName, newName);
        await saveOrder(renameIn(gestureOrder, oldName, newName)); // keep its place in the list
        dropClass(oldName);
        updateSlots((slots) => renamePersonal(slots, oldName, newName));
        updateViews((v) => (v.kind === "recording" && v.gestureName === oldName ? { ...v, gestureName: newName } : v));
        setActiveGesture((name) => (name === oldName ? newName : name));
        await Promise.all([refreshCounts(), reloadClass(newName)]);
      } catch (err) {
        fail(`rename "${oldName}"`)(err);
      }
    },

    importRecordings: async (imported) => {
      await importRecordings(imported);
    },

    importModel: async (takes) => {
      try {
        const { slots, personal } = await slotsFromCato(takes, loadStandardGestureTemplate);
        if (personal.length > 0 && !(await importRecordings(personal))) return;
        updateSlots(() => slots);
        notify.success(
          `The model slots are set to Cato's model: ${slots.map(slotLabel).join(", ")}.` +
            (takes.length > MODEL_SLOTS ? ` It has ${takes.length} gestures; only the first ${MODEL_SLOTS} fit.` : ""),
        );
      } catch (err) {
        fail("import Cato's model")(err);
      }
    },

    views,
    compare,
    setCompare: async (on) => {
      if (on) {
        // The right-hand pane is never Live, so it opens on a gesture.
        const right = await loadCompareView(activeGesture, counts, modelSlots);
        if (!right) {
          notify.error("Couldn't load a gesture to compare with.");
          return;
        }
        showIn(1, right);
      } else {
        // Cleared, so comparing next time starts afresh.
        setViews((prev) => prev.map((v, i) => (i === 0 ? v : LIVE)));
      }
      setCompareState(on);
      // Comparing starts by targeting the new right-hand pane.
      setTargetView(on ? 1 : 0);
    },
    targetView,
    setTargetView,

    selectRecording: (recording) => showIn(targetView, recordingView(recording)),

    showInView: async (index, choice) => {
      setTargetView(index);
      try {
        if (!choice) {
          if (index === 0) showIn(index, LIVE); // only the first pane can be Live
        } else {
          const view = await loadView(choice);
          if (view) showIn(index, view);
        }
      } catch (err) {
        fail("load the gesture")(err);
      }
    },

    positionResets,
    resetPosition: () => setPositionResets((n) => n + 1),
    slowMotion,
    setSlowMotion,

    modelSlots,
    setModelSlot: (index, slot) => updateSlots((slots) => setSlot(slots, index, slot)),
    deviceSlots,
    resetModelSlots: () => {
      if (deviceSlots) updateSlots(() => deviceSlots);
    },
    isGenerating,

    buildModel: async () => {
      setIsGenerating(true);
      const templates: [string, Template][] = [];
      const failed: string[] = [];
      for (const slot of modelSlots) {
        const label = slotLabel(slot);
        try {
          const template = await loadSlotTemplate(slot);
          if (template) templates.push([label, template]);
          else failed.push(label);
        } catch (err) {
          console.error(`Gestures: couldn't build the template for "${label}"`, err);
          failed.push(label);
        }
      }
      setIsGenerating(false);
      // Leaving one out would move the gestures after it to other slots.
      if (failed.length > 0) {
        notify.error(
          `Couldn't build ${failed.join(", ")}, so no model was made. ` +
            "Recordings need the whole gesture inside the capture window.",
        );
        return null;
      }
      return templates;
    },
  };

  return <GestureStoreContext.Provider value={store}>{children}</GestureStoreContext.Provider>;
};
