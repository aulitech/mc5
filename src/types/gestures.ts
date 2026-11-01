// Gesture collection / template types. Samples use array triples (not the
// {x,y,z} objects the device layer emits) so templateGen, IndexedDB and the
// visualizer all share one shape.

export type Triple = [number, number, number];

export interface Sample {
  ts?: number;
  acc: Triple;
  gyro: Triple;
}

export type TemplateChannel =
  | "acc_x"
  | "acc_y"
  | "acc_z"
  | "gyro_x"
  | "gyro_y"
  | "gyro_z";

/** Averaged gesture: one fixed-length series per IMU channel. */
export type Template = Record<TemplateChannel, number[]>;

export interface Recording {
  id: number;
  gestureName: string;
  timestamp: string;
  data: Sample[];
}

/** One gesture slot of the model: a personal (recorded) gesture by name, or a
 * pretrained (standard) one by id. */
export type ModelSlot = { kind: "personal"; name: string } | { kind: "pretrained"; id: string };
