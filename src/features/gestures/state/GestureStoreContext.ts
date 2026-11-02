import { createContext, useContext } from "react";
import type { ModelSlot, Recording, Sample, Template } from "../../../types/gestures";
import type { RecordingData } from "../lib/recordingFile";

/** What one pane of the 3D visualizer shows. */
export type ViewSource =
  | { kind: "recording"; id: number; gestureName: string; timestamp: string; samples: Sample[] }
  | { kind: "standard"; id: string; samples: Sample[] }
  | { kind: "live" };

/** The gesture a pane shows, named as a model slot names it; null for Live. */
export const viewSlot = (source: ViewSource): ModelSlot | null =>
  source.kind === "live"
    ? null
    : source.kind === "recording"
      ? { kind: "personal", name: source.gestureName }
      : { kind: "pretrained", id: source.id };

/** What a pane shows unless something else is chosen. */
export const LIVE: ViewSource = { kind: "live" };

/** Visualizer panes: the first always shows; the second only when comparing. */
export const VIEW_COUNT = 2;

export interface GestureStore {
  // ── Recording ──
  /** The gesture new takes are recorded as (an existing class or a new name), or null. */
  activeGesture: string | null;
  /** Choose the gesture to record, and set the viewer up for it: one pane, live, normal speed. */
  selectGesture: (gestureName: string) => void;
  /** Add a gesture to the list (saved, with no recordings yet) and choose it; an existing one is just chosen. */
  addGesture: (gestureName: string) => Promise<void>;

  // ── Recordings ──
  /** Recording count per gesture in the list (0 for one with none). */
  counts: Record<string, number>;
  /** The gestures list, in order (see lib/gestureOrder) — with or without recordings. */
  gestureOrder: string[];
  /** Recordings per class, newest first — only for classes that have been loaded. */
  recordings: Record<string, Recording[]>;
  loadRecordings: (gestureName: string) => Promise<void>;
  /** Resolves false (after notifying) if the recording couldn't be saved. */
  addRecording: (gestureName: string, samples: Sample[]) => Promise<boolean>;
  deleteRecording: (recording: Recording) => Promise<void>;
  deleteClass: (gestureName: string) => Promise<void>;
  /** Relabel a class; renaming onto an existing class merges them. */
  renameClass: (oldName: string, newName: string) => Promise<void>;
  /** Add imported recordings, skipping any already stored (same class and timestamp). */
  importRecordings: (recordings: RecordingData[]) => Promise<void>;
  /**
   * Take on the model read from Cato's drive (one take per class): its
   * personal gestures are imported as recordings, and the slots set to its
   * gestures, in its order.
   */
  importModel: (takes: RecordingData[]) => Promise<void>;

  // ── Visualizer ──
  /** What each pane shows (VIEW_COUNT entries; LIVE by default). */
  views: ViewSource[];
  /** Two panes side by side, played in sync, instead of one. */
  compare: boolean;
  /** Turning it on loads a gesture into the right-hand pane first (it's never Live). */
  setCompare: (on: boolean) => Promise<void>;
  /** The pane selectRecording fills (and showInView targets). */
  targetView: number;
  setTargetView: (index: number) => void;
  selectRecording: (recording: Recording) => void;
  /** Show Live (null; first pane only), a personal gesture's newest recording or a pretrained gesture in pane `index`. */
  showInView: (index: number, choice: ModelSlot | null) => Promise<void>;
  /** Bumped to put every pane back at its rest pose (pressing Record). */
  positionResets: number;
  resetPosition: () => void;
  /** Replays at half speed. */
  slowMotion: boolean;
  setSlowMotion: (on: boolean) => void;

  // ── Model ──
  /** The model's gestures, in order: the filled slots (at most MODEL_SLOTS). */
  modelSlots: ModelSlot[];
  /** Fill slot `index`, or empty it (null) — later slots move up. */
  setModelSlot: (index: number, slot: ModelSlot | null) => void;
  /**
   * The slots as the model installed on Cato has them (from its gesture
   * list, as when the slots are first filled); null with no Cato connected.
   */
  deviceSlots: ModelSlot[] | null;
  /** Set every slot back to deviceSlots. */
  resetModelSlots: () => void;
  isGenerating: boolean;
  /** Each slot's template, in slot order; null (after notifying) if any couldn't be built. */
  buildModel: () => Promise<[string, Template][] | null>;
}

export const GestureStoreContext = createContext<GestureStore | null>(null);

export const useGestureStore = () => {
  const context = useContext(GestureStoreContext);
  if (!context) throw new Error("useGestureStore must be used within a GestureStoreProvider");
  return context;
};
