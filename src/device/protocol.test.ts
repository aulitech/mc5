import { describe, expect, it } from "vitest";
import {
  MSG,
  OTA_FR,
  applyResponseChunk,
  createPracticeDecoder,
  encodeCommand,
  initialResponseState,
  normalizeGestureList,
  parseStatus,
  responseText,
  type ResponseState,
} from "./protocol";

// Build a feature report as the device returns it:
// [reportId, 0x00, 0xFF, msgType, lenLSB, lenMSB, ...payload]
function responseReport(msgType: number, length: number, payload: string | Uint8Array) {
  const bytes = new Uint8Array(OTA_FR.read.headerLength + 238);
  bytes.set([OTA_FR.id, 0x00, 0xff, msgType, length & 0xff, (length >> 8) & 0xff]);
  bytes.set(typeof payload === "string" ? new TextEncoder().encode(payload) : payload, OTA_FR.read.headerLength);
  return new DataView(bytes.buffer);
}

// Split a response into FIRST/MID reports the way the device sends it.
function chunkedResponse(text: string, chunkSize = 238) {
  const bytes = new TextEncoder().encode(text);
  const reports: DataView[] = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const msgType = offset === 0 ? MSG.FIRST : MSG.MID;
    reports.push(responseReport(msgType, bytes.length - offset, bytes.slice(offset, offset + chunkSize)));
  }
  return reports;
}

const decodeAll = (reports: DataView[]) => {
  let state: ResponseState = initialResponseState();
  for (const report of reports) {
    state = applyResponseChunk(state, report);
    if (state.remaining === 0) break;
  }
  return state;
};

function practiceReport(ts: number, latched: number, slots: number[]) {
  const view = new DataView(new ArrayBuffer(5 + slots.length * 2));
  view.setUint32(0, ts, true);
  view.setUint8(4, latched);
  slots.forEach((slot, i) => view.setUint16(5 + i * 2, slot, true));
  return view;
}

// slot = [bit 15 threshold | bits 8-14 confidence | low byte gesture index]
const slot = (gesture: number, confidence: number, threshold = false) =>
  (threshold ? 0x8000 : 0) | (confidence << 8) | gesture;

describe("encodeCommand", () => {
  it("fits a short command in one FIRST packet with a length header", () => {
    const [packet, ...rest] = encodeCommand("init");
    expect(rest).toHaveLength(0);
    expect(packet).toHaveLength(OTA_FR.write.length);
    expect([...packet.slice(0, 5)]).toEqual([0x00, 0xff, MSG.FIRST, 4, 0]);
    expect(new TextDecoder().decode(packet.slice(5, 9))).toBe("init");
  });

  it("splits long commands into FIRST then MID packets with remaining-length headers", () => {
    const command = "x".repeat(OTA_FR.write.maxData + 10);
    const packets = encodeCommand(command);
    expect(packets).toHaveLength(2);
    expect(packets[0][2]).toBe(MSG.FIRST);
    expect(packets[0][3] | (packets[0][4] << 8)).toBe(command.length);
    expect(packets[1][2]).toBe(MSG.MID);
    expect(packets[1][3] | (packets[1][4] << 8)).toBe(10);
  });
});

describe("applyResponseChunk", () => {
  it("returns a single RESULT", () => {
    const state = applyResponseChunk(initialResponseState(), responseReport(MSG.RESULT, 7, '{"a":1}'));
    expect(state.remaining).toBe(0);
    expect(responseText(state)).toBe('{"a":1}');
  });

  it("accumulates FIRST/MID chunks until the length is satisfied", () => {
    const full = "a".repeat(238) + "bcd";
    let state = applyResponseChunk(initialResponseState(), responseReport(MSG.FIRST, full.length, full.slice(0, 238)));
    expect(state.remaining).toBe(3);
    state = applyResponseChunk(state, responseReport(MSG.MID, 3, "bcd"));
    expect(state.remaining).toBe(0);
    expect(state.error).toBeNull();
    expect(responseText(state)).toBe(full);
  });

  it("decodes multi-byte UTF-8 by byte length, without trailing padding", () => {
    const text = '{"name":"Mañana ☕"}';
    const state = decodeAll(chunkedResponse(text));
    expect(state.remaining).toBe(0);
    expect(responseText(state)).toBe(text);
  });

  it("keeps a multi-byte character that straddles two reports intact", () => {
    // 'é' is 2 bytes; an odd-length prefix puts one split across the boundary.
    const text = JSON.stringify({ name: "xx" + "é".repeat(150) }); // 11-byte prefix
    const reports = chunkedResponse(text);
    expect(reports).toHaveLength(2);
    const state = decodeAll(reports);
    expect(state.remaining).toBe(0);
    expect(responseText(state)).toBe(text);
  });

  it("keeps waiting after ACK_RSP and records NACK errors", () => {
    expect(applyResponseChunk(initialResponseState(), responseReport(MSG.ACK_RSP, 0, "")).remaining).toBe(1);
    const nack = applyResponseChunk(initialResponseState(), responseReport(MSG.NACK, 9, "bad thing"));
    expect(nack.error).toBe("bad thing");
  });
});

describe("parseStatus", () => {
  it("decodes indices and flag bits", () => {
    const status = parseStatus(new DataView(new Uint8Array([3, 7, 0b1010_0001, 2]).buffer));
    expect(status).toMatchObject({
      gestureIdx: 3,
      actionIdx: 7,
      conIdx: 2,
      hbLost: true,
      deepSleep: false,
      unsavedChanges: true,
      dwellClick: true,
      practice: false,
    });
  });
});

describe("normalizeGestureList", () => {
  it("accepts strings or {label} objects and restores spaces", () => {
    expect(normalizeGestureList(["Nod_Right", { label: "Wrist_Flick" }])).toEqual(["Nod Right", "Wrist Flick"]);
    expect(normalizeGestureList(undefined)).toEqual([]);
  });
});

describe("practice decoder", () => {
  const names = ["Idle", "Movement", "Nod Up", "Nod Down"];

  it("collapses repeated reports into one row with a count", () => {
    const decoder = createPracticeDecoder();
    const first = decoder.decode(practiceReport(100, 2, [slot(2, 80, true)]), names);
    const second = decoder.decode(practiceReport(110, 2, [slot(2, 80, true)]), names);
    expect(first?.count).toBe(1);
    expect(second?.count).toBe(2);
    expect(first).not.toBe(second); // fresh objects for React state
  });

  it("marks the return to idle as the trigger for the latched gesture", () => {
    const decoder = createPracticeDecoder();
    decoder.decode(practiceReport(100, 3, [slot(3, 90, true)]), names);
    const idle = decoder.decode(practiceReport(120, 0, [slot(0, 95)]), names);
    expect(idle?.trigger).toBe("Nod Down");
    expect(idle?.latchedLabel).toBe("Idle");
  });

  it("ignores reports with no gesture data", () => {
    const decoder = createPracticeDecoder();
    expect(decoder.decode(practiceReport(100, 0, [0, 0]), names)).toBeNull();
  });
});
