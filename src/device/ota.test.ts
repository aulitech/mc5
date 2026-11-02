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
    vendorId: 0x1915,
    productId: 0x52dd,
    open: async () => {
      device.opened = true;
    },
    close: async () => {
      device.opened = false;
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

/** navigator.hid offering `device` in its picker; `fire` sends it a connect/disconnect event. */
function stubHid(device: unknown) {
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  vi.stubGlobal("navigator", {
    hid: {
      requestDevice: async () => [device],
      addEventListener: (type: string, fn: (event: unknown) => void) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(fn);
      },
      removeEventListener: (type: string, fn: (event: unknown) => void) => listeners.get(type)?.delete(fn),
    },
  });
  return {
    fire: (type: "connect" | "disconnect", device: unknown) =>
      [...(listeners.get(type) ?? [])].forEach((fn) => fn({ device })),
  };
}

const answersInit = (command: string) => (command === "init" ? chunked(JSON.stringify(INFO)) : []);

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

describe("reconnecting", () => {
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

  /** Connect to a fake Cato and record the connection events from then on. */
  async function connected() {
    const cato = fakeCato(answersInit);
    const hid = stubHid(cato.device);
    const connecting = ota.connect();
    await vi.advanceTimersByTimeAsync(100);
    await connecting;
    const events: string[] = [];
    ota.on("connect", () => events.push("connect"));
    ota.on("disconnect", ({ reconnecting, error }) =>
      events.push(`disconnect${reconnecting ? " (reconnecting)" : ""}${error ? `: ${error}` : ""}`),
    );
    return { cato, hid, events };
  }

  it("opens Cato again by itself when it comes back after dropping off (e.g. a reboot)", async () => {
    const { cato, hid, events } = await connected();
    hid.fire("disconnect", cato.device);
    expect(ota.isConnected()).toBe(false);

    // After a reboot the browser hands over a new device object for it.
    const back = fakeCato(answersInit);
    hid.fire("connect", back.device);
    await vi.advanceTimersByTimeAsync(100);
    expect(events).toEqual(["disconnect (reconnecting)", "connect"]);
    expect(ota.isConnected()).toBe(true);
    expect(back.commands).toEqual(["init"]);
  });

  it("doesn't reconnect after Disconnect, nor to a device that isn't a Cato", async () => {
    const { cato, hid, events } = await connected();
    hid.fire("disconnect", cato.device);
    hid.fire("connect", { ...fakeCato(answersInit).device, productId: 0x1234 }); // not a Cato
    await vi.advanceTimersByTimeAsync(100);
    expect(ota.isConnected()).toBe(false);

    await ota.close(); // stop waiting for it
    const back = fakeCato(answersInit);
    hid.fire("connect", back.device);
    await vi.advanceTimersByTimeAsync(100);
    expect(events).toEqual(["disconnect (reconnecting)", "disconnect"]);
    expect(back.commands).toEqual([]);
  });

  it("tries a few times, then gives up and says why", async () => {
    const { cato, hid, events } = await connected();
    hid.fire("disconnect", cato.device);
    const back = fakeCato(answersInit);
    let opens = 0;
    back.device.open = async () => {
      opens++;
      throw new Error("busy");
    };
    hid.fire("connect", back.device);
    await vi.advanceTimersByTimeAsync(5000);
    expect(opens).toBe(3);
    expect(events).toEqual(["disconnect (reconnecting)", "disconnect: busy"]);
    expect(ota.isConnected()).toBe(false);
  });

  it("asks a Cato that wasn't ready again, once asking works", async () => {
    const { cato, hid } = await connected();
    hid.fire("disconnect", cato.device);
    const back = fakeCato(answersInit);
    const send = back.device.sendFeatureReport;
    let sends = 0;
    back.device.sendFeatureReport = async (id, packet) => {
      if (sends++ === 0) throw new Error("not ready");
      return send(id, packet);
    };
    hid.fire("connect", back.device);
    await vi.advanceTimersByTimeAsync(2000);
    expect(ota.isConnected()).toBe(true);
    expect(back.commands).toEqual(["init"]);
  });

  it("picks Cato up again through the picker (Reconnect) without a disconnect in between", async () => {
    const { cato, hid, events } = await connected();
    hid.fire("disconnect", cato.device);
    const back = fakeCato(answersInit);
    stubHid(back.device); // the picker now offers the Cato that came back
    const connecting = ota.connect();
    await vi.advanceTimersByTimeAsync(100);
    await connecting;
    expect(events).toEqual(["disconnect (reconnecting)", "connect"]);
    expect(ota.isConnected()).toBe(true);
  });
});
