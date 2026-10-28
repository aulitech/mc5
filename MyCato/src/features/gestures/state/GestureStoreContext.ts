import { createContext, useContext } from "react";
import type { GestureModel, Recording, Sample } from "../../../types/gestures";

/** What the 3D visualizer is currently showing. */
export type VisualizerSelection =
  | { kind: "recording"; id: number; gestureName: string; samples: Sample[] }
  | { kind: "standard"; id: string; samples: Sample[] };

export interface GestureStore {
  // ── Recordings ──
  /** Recording count per gesture class. */
  counts: Record<string, number>;
  /** Recordings per class, newest first — only for classes that have been loaded. */
  recordings: Record<string, Recording[]>;
  loadRecordings: (gestureName: string) => Promise<void>;
  addRecording: (gestureName: string, samples: Sample[]) => Promise<void>;
  deleteRecording: (recording: Recording) => Promise<void>;
  deleteClass: (gestureName: string) => Promise<void>;
  /** Relabel a class; renaming onto an existing class merges them. */
  renameClass: (oldName: string, newName: string) => Promise<void>;

  // ── Visualizer ──
  selection: VisualizerSelection | null;
  selectRecording: (recording: Recording) => void;
  selectStandard: (id: string) => Promise<void>;

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
