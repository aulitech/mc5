// Shapes produced by the device layer (src/device). Everything here is decoded
// from HID reports or returned by the device's "init" command.

export interface DeviceInfo {
  version?: { string?: string; [key: string]: unknown };
  conn_idx?: number;
  /** Gesture class labels, index-aligned with the model's output slots. */
  gesture_list: string[];
  [key: string]: unknown;
}

export interface CatoDevice {
  productName: string;
  info: DeviceInfo;
}

/** Decoded STATUS input report (also carries the heartbeat). */
export interface DeviceStatus {
  conIdx: number;
  gestureIdx: number;
  actionIdx: number;
  hbLost: boolean;
  deepSleep: boolean;
  unsavedChanges: boolean;
  pointerSleep: boolean;
  scrolling: boolean;
  practice: boolean;
  holdTilIdle: boolean;
  dwellClick: boolean;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** One SENSOR_STREAM input report: accel + gyro (deg/s) at ~100 Hz. */
export interface SensorReport {
  ts: number;
  acc: Vec3;
  gyro: Vec3;
}

export interface GestureScore {
  label: string;
  confidence: number;
  threshold: boolean;
}

/** One PRACTICE input report, with repeat-collapsing state applied. */
export interface PracticeInference {
  ts: number;
  dt: number;
  latched: number;
  count: number;
  latchedLabel: string;
  nonNull: number;
  gestures: GestureScore[];
  /** Set on the report where a latched gesture returns to idle, i.e. fires. */
  trigger?: string;
}
