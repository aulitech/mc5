import { createContext, useContext } from "react";
import type { GestureModel, Recording, Sample } from "../../../types/gestures";
import type { RecordingData } from "../lib/recordingFile";

/** What one pane of the 3D visualizer shows. */
export type ViewSource =
  | { kind: "recording"; id: number; gestureName: string; timestamp: string; samples: Sample[] }
  | { kind: "standard"; id: string; samples: Sample[] }
  | { kind: "live" };

/** Visualizer panes: the first always shows; the second only when comparing. */
export const VIEW_COUNT = 2;

export interface GestureStore {
  // ── Recording ──
  /** The gesture new takes are recorded as (an existing class or a new name), or null. */
  activeGesture: string | null;
  /** Choose the gesture to record, and set the viewer up for it: one pane, live, normal speed. */
  selectGesture: (gestureName: string) => void;

  // ── Recordings ──
  /** Recording count per gesture class. */
  counts: Record<string, number>;
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

  // ── Visualizer ──
  /** What each pane shows (VIEW_COUNT entries; null = empty). */
  views: (ViewSource | null)[];
  /** Two panes side by side, played in sync, instead of one. */
  compare: boolean;
  setCompare: (on: boolean) => void;
  /** The pane that selectRecording/selectStandard/toggleLive fill. */
  targetView: number;
  setTargetView: (index: number) => void;
  selectRecording: (recording: Recording) => void;
  selectStandard: (id: string) => Promise<void>;
  /** Show the live sensor stream in the target pane, or clear it if it already does. */
  toggleLive: () => void;
  /** Replays at half speed. */
  slowMotion: boolean;
  setSlowMotion: (on: boolean) => void;

  // ── Model generation ──
  /** Recorded classes checked for the next model. */
  checkedClasses: Set<string>;
  toggleClass: (gestureName: string) => void;
  /** Built-in standard gestures (by id) checked for the next model. */
  checkedStandards: Set<string>;
  toggleStandard: (id: string) => void;
  models: GestureModel[];
  isGenerating: boolean;
  generateModel: (modelName: string) => Promise<void>;
  deleteModel: (id: number) => Promise<void>;
}

export const GestureStoreContext = createContext<GestureStore | null>(null);

export const useGestureStore = () => {
  const context = useContext(GestureStoreContext);
  if (!context) throw new Error("useGestureStore must be used within a GestureStoreProvider");
  return context;
};
