import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ota from "./ota";
import { MSG, OTA_FR } from "./protocol";

// The device's answer to "init": long enough to take three reports.
const INFO = {
  version: { string: "1.0.0" },
  conn_idx: 0,
  gesture_list: ["Idle", "Movement", "Nod_Up", "Nod_Down"],
  padding: "x".repeat(500),
};

function report(msgType: number, length: number, payload: Uint8Array) {
  const bytes = new Uint8Array(OTA_FR.read.headerLength + 238);
  bytes.set([OTA_FR.id, 0x00, 0xff, msgType, length & 0xff, (length >> 8) & 0xff]);
  bytes.set(payload, OTA_FR.read.headerLength);
  return new DataView(bytes.buffer);
}

function chunked(text: string) {
  const bytes = new TextEncoder().encode(text);
  const reports: DataView[] = [];
  for (let offset = 0; offset < bytes.length; offset += 238) {
    reports.push(report(offset === 0 ? MSG.FIRST : MSG.MID, bytes.length - offset, bytes.slice(offset, offset + 238)));
  }
  return reports;
}

const nack = (text: string) => report(MSG.NACK, text.length, new TextEncoder().encode(text));

/**
 * A fake Cato. `answer(command, n)` gives the reports queued for the nth
 * sending of a command. A read takes the next queued report and returns it
 * after `readDelays[n]` ms for the nth read, or waits forever if there was
 * none.
 */
function fakeCato(answer: (command: string, n: number) => DataView[], readDelays: number[] = []) {
  const queued: DataView[] = [];
  const commands: string[] = [];
  let reads = 0;
  const device = {
    opened: false,
    productName: "Cato",
    open: async () => {
      device.opened = true;
    },
    forget: async () => {
      device.opened = false;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    sendReport: async () => {},
    sendFeatureReport: async (_id: number, packet: Uint8Array) => {
      const command = new TextDecoder().decode(packet.slice(5, 5 + (packet[3] | (packet[4] << 8))));
      queued.push(...answer(command, commands.filter((c) => c === command).length));
      commands.push(command);
    },
    receiveFeatureReport: async () => {
      // The device hands over its next report when asked, however late that
      // report then arrives.
      const next = queued.shift();
      const wait = readDelays[reads++] ?? 0;
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
      return next ?? new Promise<DataView>(() => {});
    },
  };
  return { device, commands, reads: () => reads };
}

function stubHid(device: unknown) {
  vi.stubGlobal("navigator", {
    hid: { requestDevice: async () => [device], addEventListener: () => {}, removeEventListener: () => {} },
  });
}

describe("connect", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(async () => {
    await ota.close();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps the pieces of an init answer whose first read ran past the deadline", async () => {
    // The first read takes 12s, past the 10s deadline, but still brings back
    // the first piece; the rest come straight after.
    const cato = fakeCato((command) => (command === "init" ? chunked(JSON.stringify(INFO)) : []), [12000]);
    stubHid(cato.device);
    const connecting = ota.connect();
    await vi.advanceTimersByTimeAsync(15000);
    const connected = await connecting;
    expect(connected?.info).toMatchObject({ version: INFO.version, padding: INFO.padding });
    expect(connected?.info.gesture_list).toEqual(["Idle", "Movement", "Nod Up", "Nod Down"]);
    expect(cato.commands).toEqual(["init"]);
    expect(cato.reads()).toBe(3);
  });

  it("reads on past an unusable init answer without asking again", async () => {
    const cato = fakeCato((command) => (command === "init" ? [nack("busy"), ...chunked(JSON.stringify(INFO))] : []));
    stubHid(cato.device);
    const connecting = ota.connect();
    await vi.advanceTimersByTimeAsync(1000);
    const connected = await connecting;
    expect(connected?.info).toMatchObject({ version: INFO.version, padding: INFO.padding });
    expect(cato.commands).toEqual(["init"]);
  });
});

describe("readConfig", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(async () => {
    await ota.close();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const GLOBAL_INFO = { name: "Cato", HW_UID: "abc", profile_map: [0], action_list: [], action_names: [] };
  const PROFILE = { name: "Pointer" };

  it("skips a spare init answer queued ahead of global_info's", async () => {
    const cato = fakeCato((command) => {
      // Cato answered "init" twice; the second sits ahead of global_info's.
      if (command === "init") return [...chunked(JSON.stringify(INFO)), ...chunked(JSON.stringify(INFO))];
      if (command === "config get /global_info") return chunked(JSON.stringify(GLOBAL_INFO));
      if (command === "config get /profiles/0") return chunked(JSON.stringify(PROFILE));
      return [nack("found null node")];
    });
    stubHid(cato.device);
    const connecting = ota.connect();
    await vi.advanceTimersByTimeAsync(1000);
    await connecting;
    const reading = ota.readConfig();
    await vi.advanceTimersByTimeAsync(1000);
    const { config } = await reading;
    expect(config).toEqual({ global_info: GLOBAL_INFO, profiles: [PROFILE] });
    expect(cato.commands).toEqual([
      "init",
      "config get /global_info",
      "config get /profiles/0",
      "config get /profiles/1",
    ]);
  });
});
