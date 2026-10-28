// ota.ts — WebHID transport for Cato.
//
// Commands go out as OTA feature reports and their responses come back the
// same way. Commands are queued, so callers can fire `send()` concurrently and
// each one runs after the previous finishes. Status, sensor and practice input
// reports are published as events — subscribe with `on()`, which returns an
// unsubscribe function.

import type { Config, GlobalInfo, Profile } from "../types/config";
import type {
  CatoDevice,
  DeviceInfo,
  DeviceStatus,
  PracticeInference,
  SensorReport,
} from "../types/device";
import {
  HEARTBEAT,
  OTA_FR,
  PRACTICE,
  SENSOR_STREAM,
  STATUS,
  applyResponseChunk,
  createPracticeDecoder,
  encodeCommand,
  initialResponseState,
  normalizeGestureList,
  parseSensor,
  parseStatus,
  responseText,
} from "./protocol";

const FILTERS = [{ vendorId: 0x1915, productId: 0x52dd }];
const MAX_PROFILES = 20;

// A response that hasn't finished arriving by then is abandoned, so one stuck
// command can't hold up the queue forever. Generous, since some commands
// (e.g. "config save") write flash before answering.
const RESPONSE_TIMEOUT_MS = 10000;

// The device's answer to "config get" on a path that doesn't exist — how the
// end of the profile list shows up.
const isMissingNode = (err: unknown) => String(err).toLowerCase().includes("found null node");

// ── Events ────────────────────────────────────────────────────────────────────

export interface OtaEvents {
  connect: CatoDevice;
  disconnect: void;
  status: DeviceStatus;
  sensor: SensorReport;
  practice: PracticeInference;
}

type Listener<K extends keyof OtaEvents> = (payload: OtaEvents[K]) => void;

const listeners: { [K in keyof OtaEvents]: Set<Listener<K>> } = {
  connect: new Set(),
  disconnect: new Set(),
  status: new Set(),
  sensor: new Set(),
  practice: new Set(),
};

export function on<K extends keyof OtaEvents>(type: K, fn: Listener<K>): () => void {
  listeners[type].add(fn);
  return () => {
    listeners[type].delete(fn);
  };
}

function emit<K extends keyof OtaEvents>(type: K, payload: OtaEvents[K]) {
  for (const fn of listeners[type]) {
    try {
      fn(payload);
    } catch (err) {
      console.error(`[ota] ${type} listener failed:`, err);
    }
  }
}

// ── Connection state ──────────────────────────────────────────────────────────

let device: HIDDevice | null = null;
let info: DeviceInfo | null = null;
const practiceDecoder = createPracticeDecoder();

// Logging every sensor-stream report (100/sec while streaming) would be
// noisy and could in principle add up, so instead of logging each one, just
// track when the last one arrived and warn only if a gap appears — the IMU
// reports at a steady ~10ms interval, so anything much longer signals the
// stream has stalled. 0 means "not currently armed" (see `sendNow`, below),
// so turning streaming back on after a while doesn't immediately report a
// false gap against a stale timestamp from before it was switched off.
let lastSensorReportAt = 0;
const SENSOR_GAP_WARN_MS = 300;

// Same idea for STATUS reports, which carry the heartbeat. Normal cadence
// measured at ~9150ms on a healthy connection, so the threshold needs a
// comfortable margin above that to avoid flagging routine gaps.
let lastStatusReportAt = 0;
const STATUS_GAP_WARN_MS = 15000;

// The heartbeat ack write itself should normally take a few ms at most.
const HEARTBEAT_ACK_SLOW_MS = 50;

let lastStatusBits = -1;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const isConnected = () => device !== null && device.opened;

// ── Input reports ─────────────────────────────────────────────────────────────

async function handleStatus(view: DataView) {
  const receivedAt = Date.now();
  if (lastStatusReportAt !== 0) {
    const gap = receivedAt - lastStatusReportAt;
    if (gap > STATUS_GAP_WARN_MS) {
      console.warn(`[ota] status report gap: ${gap}ms since previous report (at ${receivedAt})`);
    }
  }
  lastStatusReportAt = receivedAt;

  const status = parseStatus(view);
  const bits = view.getUint32(0, true);
  if (bits !== lastStatusBits) {
    console.log("OTA Status Report: ", status);
    lastStatusBits = bits;
  }

  // Ack the heartbeat before publishing the status.
  const ackSentAt = Date.now();
  await device
    ?.sendReport(HEARTBEAT, new Uint8Array([0x00]))
    .then(() => {
      const ackTook = Date.now() - ackSentAt;
      if (ackTook > HEARTBEAT_ACK_SLOW_MS) {
        console.warn(`[ota] heartbeat ack slow: took ${ackTook}ms (report received at ${receivedAt})`);
      }
    })
    .catch((err) => {
      console.error(`[ota] heartbeat ack failed at ${Date.now()} (report received at ${receivedAt}): `, String(err));
    });

  emit("status", status);
}

function onInputReport(event: HIDInputReportEvent) {
  if (event.device !== device) {
    console.warn("Received report from unknown device: ", event.device);
    return;
  }
  switch (event.reportId) {
    case SENSOR_STREAM: {
      const now = Date.now();
      if (lastSensorReportAt !== 0) {
        const gap = now - lastSensorReportAt;
        if (gap > SENSOR_GAP_WARN_MS) {
          console.warn(`[ota] sensor stream gap: ${gap}ms since previous report (at ${now})`);
        }
      }
      lastSensorReportAt = now;
      emit("sensor", parseSensor(event.data));
      break;
    }
    case STATUS:
      handleStatus(event.data);
      break;
    case PRACTICE: {
      const inference = practiceDecoder.decode(event.data, info?.gesture_list ?? []);
      if (inference) emit("practice", inference);
      break;
    }
    default:
      console.warn("Unknown Input Report ID: ", event.reportId);
      break;
  }
}

function onHidDisconnect(event: HIDConnectionEvent) {
  console.log("HID Device disconnected: event: ", event.device, "device: ", device);
  if (event.device === device) close().catch(() => {});
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function receiveResponse(d: HIDDevice): Promise<unknown> {
  if (!d.opened) throw new Error("Device not opened");

  const deadline = Date.now() + RESPONSE_TIMEOUT_MS;
  let state = initialResponseState();
  while (state.remaining > 0) {
    const dv = await withDeadline(d.receiveFeatureReport(OTA_FR.id), deadline).catch((err) => {
      throw new Error(`Error receiving feature report: ${String(err)}`);
    });
    state = applyResponseChunk(state, dv);
  }

  if (state.error) {
    if (isMissingNode(state.error)) {
      console.warn("OTA Warning: Found null node.");
    } else {
      console.error("OTA Error in report response: ", state.error);
    }
    throw new Error(state.error);
  }

  const text = responseText(state);
  if (text.length === 0) return text;
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error("Error parsing JSON response: " + String(e));
  }
}

function withDeadline<T>(promise: Promise<T>, deadline: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`No response from Cato within ${RESPONSE_TIMEOUT_MS / 1000}s`)),
      Math.max(0, deadline - Date.now()),
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function sendNow(command: string): Promise<unknown> {
  const d = device;
  if (!d) throw new Error("No connected device");
  if (!d.opened) throw new Error("Device not opened");
  if (!command) throw new Error("No data");

  // Reset the sensor-stream gap detector whenever streaming is toggled, so a
  // stale timestamp from before an "off" doesn't read as a false gap against
  // the first report of a later "on".
  if (command === "sensor_stream on" || command === "sensor_stream off") {
    lastSensorReportAt = 0;
  }

  console.log("OTA Sending: ", command);
  for (const packet of encodeCommand(command)) {
    try {
      await d.sendFeatureReport(OTA_FR.id, packet);
    } catch (e) {
      throw new Error(`Error sending feature report: ${String(e)}`);
    }
  }

  const res = await receiveResponse(d).catch((err) => {
    throw new Error(`Error processing feature report: ${String(err)}`);
  });
  console.log("OTA Response: ", res);
  return res;
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Send a text command and resolve with the device's (JSON-parsed) response.
 * Calls are serialized — a send issued while another is in flight waits for
 * it rather than failing.
 */
export function send<T = unknown>(command: string): Promise<T> {
  const result = queue.then(() => sendNow(command));
  queue = result.catch(() => undefined);
  return result as Promise<T>;
}

// ── Connect / disconnect ──────────────────────────────────────────────────────

async function initialize(d: HIDDevice): Promise<DeviceInfo> {
  let result: Partial<DeviceInfo> | null = null;
  try {
    result = await send<DeviceInfo>("init");
  } catch (e) {
    console.error("Error during device initialization: ", String(e));
    await delay(500);
  }

  // Recovery: if "init" failed, the response may still be pending — keep
  // reading feature reports for a while before giving up.
  let retry = 0;
  while (!result?.version && retry < 15) {
    try {
      result = (await receiveResponse(d)) as Partial<DeviceInfo>;
    } catch (e) {
      console.error("Error during initialization recovery: ", String(e));
      await delay(500);
    }
    retry += 1;
    console.log(`Initialization attempt (${retry})`, result);
  }

  if (!result?.version) {
    throw new Error("Failed to initialize device after multiple attempts. Reset Cato and try again.");
  }
  return { ...result, gesture_list: normalizeGestureList(result.gesture_list) };
}

/**
 * Prompt the user to pick a Cato and open it. Resolves with the device, or
 * null if the picker was dismissed. Emits "connect" and an initial "status".
 */
export async function connect(): Promise<CatoDevice | null> {
  const [selected] = await navigator.hid.requestDevice({ filters: FILTERS });
  if (!selected) return null;

  await close().catch(() => {}); // drop any previous device and its listeners
  try {
    device = selected;
    await selected.open();
    console.log("Device opened: ", selected);
    navigator.hid.addEventListener("disconnect", onHidDisconnect);
    selected.addEventListener("inputreport", onInputReport);

    info = await initialize(selected);
    practiceDecoder.reset();

    const connected: CatoDevice = { productName: selected.productName, info };
    emit("connect", connected);
    emit("status", parseStatus(new DataView(new Uint8Array([0, 0, 0, info.conn_idx ?? 0]).buffer)));
    return connected;
  } catch (error) {
    console.error("Error connecting to device: ", error);
    await close().catch(() => {});
    throw error;
  }
}

export interface ReadConfigResult {
  config: Config;
  /**
   * Set when a profile couldn't be read (twice) for a reason other than the
   * list ending — profiles from this index on are missing from `config`.
   */
  unreadProfile?: number;
}

/** Read global_info and every profile from the connected device. */
export async function readConfig(): Promise<ReadConfigResult> {
  const global_info = await send<GlobalInfo>("config get /global_info");
  const profiles: Profile[] = [];
  for (let i = 0; i < MAX_PROFILES; i++) {
    const read = () => send<Profile>(`config get /profiles/${i}`);
    try {
      profiles.push(await read().catch((err) => (isMissingNode(err) ? Promise.reject(err) : read())));
    } catch (err) {
      if (isMissingNode(err)) {
        console.log("End of profiles at index ", i);
        break;
      }
      console.error(`Couldn't read profile ${i}:`, err);
      return { config: { global_info, profiles }, unreadProfile: i };
    }
  }
  return { config: { global_info, profiles } };
}

/** Forget the device and emit "disconnect". Safe to call when not connected. */
export async function close(): Promise<void> {
  const d = device;
  if (!d) return;
  device = null;
  info = null;
  navigator.hid.removeEventListener("disconnect", onHidDisconnect);
  d.removeEventListener("inputreport", onInputReport);

  try {
    if (d.opened) await d.forget();
    console.log("Device closed: ", d);
  } catch (err) {
    throw new Error(`Error closing device: ${String(err)}`);
  } finally {
    emit("disconnect", undefined);
  }
}

const ota = { connect, close, send, readConfig, isConnected, on };
export default ota;
