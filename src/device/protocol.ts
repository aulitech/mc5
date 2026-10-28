// protocol.ts — Pure encode/decode for Cato's WebHID reports. No I/O here;
// ota.ts does the actual sending/receiving.

import type {
  DeviceStatus,
  PracticeInference,
  SensorReport,
} from "../types/device";

// Report IDs
export const OTA_CONTROL = 6;
export const SENSOR_STREAM = 7;
export const PRACTICE = 8;
export const STATUS = 9;
export const HEARTBEAT = 10;

export const OTA_FR = {
  id: OTA_CONTROL,
  write: {
    length: 244,
    headerLength: 5, // 0:0x00, 1:0xFF, 2:msgType, 3:lenLSB, 4:lenMSB
    maxData: 244 - 5,
  },
  // Incoming feature reports include a 6-byte header in the returned DataView:
  // [0]=reportId, [1]=0x00, [2]=0xFF, [3]=msgType, [4]=lenLSB, [5]=lenMSB, then payload
  read: {
    headerLength: 6,
    msgTypeIndex: 3,
    lenIndex: 4,
  },
} as const;

export const MSG = {
  FIRST: 0,
  MID: 1,
  ACK_NRSP: 2,
  ACK_RSP: 3,
  NACK: 4,
  EMPTY: 5,
  RESULT: 6,
} as const;

// ── Command encoding ──────────────────────────────────────────────────────────

/**
 * Split a text command into OTA feature-report packets. Each packet is
 * OTA_FR.write.length bytes: a 5-byte header ([0x00, 0xFF, msgType, lenLSB,
 * lenMSB], where len is the number of bytes remaining including this packet)
 * followed by up to maxData payload bytes. msgType is FIRST, then MID.
 */
export function encodeCommand(command: string): Uint8Array<ArrayBuffer>[] {
  const bytes = new TextEncoder().encode(command);
  const packets: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    const remaining = bytes.length - offset;
    const chunkLen = Math.min(OTA_FR.write.maxData, remaining);
    const msgType = offset === 0 ? MSG.FIRST : MSG.MID;

    const packet = new Uint8Array(OTA_FR.write.length);
    packet.set([0x00, 0xff, msgType, remaining & 0xff, (remaining >> 8) & 0xff], 0);
    packet.set(bytes.slice(offset, offset + chunkLen), OTA_FR.write.headerLength);
    packets.push(packet);

    offset += chunkLen;
  }
  return packets;
}

// ── Response decoding ─────────────────────────────────────────────────────────

export interface ResponseState {
  /** >0 while more feature reports are expected. */
  remaining: number;
  /**
   * Raw UTF-8 payload so far. Lengths in the report header count bytes, and a
   * multi-byte character can straddle two reports, so decoding waits until
   * the whole response is in (see responseText).
   */
  bytes: Uint8Array;
  error: string | null;
}

export const initialResponseState = (): ResponseState => ({
  remaining: 1,
  bytes: new Uint8Array(0),
  error: null,
});

const concatBytes = (a: Uint8Array, b: Uint8Array) => {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
};

/** The accumulated response decoded as text. */
export const responseText = (state: ResponseState) => new TextDecoder().decode(state.bytes);

/** Fold one received feature report into the accumulated response. */
export function applyResponseChunk(state: ResponseState, dv: DataView): ResponseState {
  const payload = new Uint8Array(
    dv.buffer,
    dv.byteOffset + OTA_FR.read.headerLength,
    Math.max(0, dv.byteLength - OTA_FR.read.headerLength),
  );
  // Bytes still to come, including this report's.
  const reportLength = dv.getUint16(OTA_FR.read.lenIndex, true);
  const msgType = dv.getUint8(OTA_FR.read.msgTypeIndex);
  const chunk = payload.slice(0, Math.min(reportLength, payload.length));

  const next: ResponseState = { ...state, remaining: 0 };
  switch (msgType) {
    case MSG.FIRST:
    case MSG.MID:
      next.remaining = Math.max(0, reportLength - chunk.length);
      next.bytes = concatBytes(state.bytes, chunk);
      break;
    case MSG.ACK_NRSP:
      break;
    case MSG.ACK_RSP:
      next.remaining = 1;
      break;
    case MSG.NACK:
      next.error = new TextDecoder().decode(chunk);
      break;
    case MSG.EMPTY:
      next.error = "Empty response from device.";
      break;
    case MSG.RESULT:
      next.bytes = chunk;
      break;
    default:
      next.error = `Unknown message type: ${String(msgType)}`;
      break;
  }
  return next;
}

// ── Input reports ─────────────────────────────────────────────────────────────

export function parseStatus(view: DataView): DeviceStatus {
  const status = view.getUint8(2);
  return {
    gestureIdx: view.getUint8(0),
    actionIdx: view.getUint8(1),
    conIdx: view.getUint8(3),
    hbLost: (status & 0x80) !== 0,
    deepSleep: (status & 0x40) !== 0,
    unsavedChanges: (status & 0x20) !== 0,
    pointerSleep: (status & 0x10) !== 0,
    scrolling: (status & 0x08) !== 0,
    practice: (status & 0x04) !== 0,
    holdTilIdle: (status & 0x02) !== 0,
    dwellClick: (status & 0x01) !== 0,
  };
}

export function parseSensor(view: DataView): SensorReport {
  return {
    ts: view.getUint32(0, true),
    acc: {
      x: view.getFloat32(4, true),
      y: view.getFloat32(8, true),
      z: view.getFloat32(12, true),
    },
    gyro: {
      x: view.getFloat32(16, true),
      y: view.getFloat32(20, true),
      z: view.getFloat32(24, true),
    },
  };
}

/**
 * The device's gesture_list labels come from model_params.csv, where spaces in
 * a gesture name are replaced with underscores before export (the device's own
 * parser tokenizes on whitespace — see templateGen.ts). Reverse that here so
 * the whole app sees the friendly name. Accepts plain strings or {label}
 * objects, since firmware versions have differed.
 */
export function normalizeGestureList(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list.map((g) => {
    const label =
      typeof g === "object" && g !== null && "label" in g
        ? String((g as { label: unknown }).label)
        : String(g);
    return label.replace(/_/g, " ");
  });
}

const idleInference = (): PracticeInference => ({
  ts: Number.MAX_VALUE,
  dt: 0,
  latched: 0,
  count: 0,
  latchedLabel: "",
  nonNull: 0,
  gestures: [],
});

/**
 * Decoder for PRACTICE reports. Stateful: consecutive identical reports are
 * collapsed into one row with an incrementing count, and the transition from
 * a latched gesture back to idle is marked with `trigger`.
 * Each call returns a fresh object, safe to put straight into React state.
 */
export function createPracticeDecoder() {
  let last = idleInference();

  return {
    reset() {
      last = idleInference();
    },

    decode(view: DataView, gestureNames: string[]): PracticeInference | null {
      // Bytes 5.. are uint16 slots: [low byte = gesture index,
      // bits 8-14 = confidence %, bit 15 = over threshold]. Empty slots are 0.
      const results: number[] = [];
      for (let i = 5; i + 1 < view.byteLength; i += 2) {
        const x = view.getUint16(i, true);
        if ((x & 0x7f00) > 0) results.push(x);
      }
      if (results.length < 1) {
        console.log("Invalid input report. No gesture data");
        return null;
      }

      const ts = view.getUint32(0, true);
      const latched = view.getUint8(4);
      const dt =
        latched === 0 && last.latched < 2 // transition to idle
          ? 0
          : ts - last.ts > 0
            ? ts - last.ts + last.dt
            : 0;

      const inference: PracticeInference = {
        ts,
        dt,
        latched,
        count: 1,
        latchedLabel: gestureNames[latched] || "Unknown",
        // sum the confidence of all gestures, skipping "Idle" and "Movement"
        nonNull: results.reduce(
          (total, x) => ((x & 0x00ff) > 1 ? total + ((x & 0x7f00) >> 8) : total),
          0,
        ),
        gestures: results.map((x) => ({
          label: gestureNames[x & 0x00ff] || "Unknown",
          confidence: (x & 0x7f00) >> 8,
          threshold: (x & 0x8000) > 0,
        })),
      };

      // Repeated inference: bump the count on the previous row instead.
      if (
        last.latched === inference.latched &&
        JSON.stringify(last.gestures) === JSON.stringify(inference.gestures)
      ) {
        last = { ...last, count: last.count + 1, dt: inference.dt };
        delete last.trigger;
        return { ...last };
      }

      // Transition from a latched gesture back to idle fires that gesture.
      if (inference.latched === 0 && last.latched > 1) {
        inference.trigger = last.latchedLabel;
      }

      last = inference;
      return { ...inference };
    },
  };
}
