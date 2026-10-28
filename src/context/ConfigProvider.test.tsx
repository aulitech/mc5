// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONFIG_DATA } from "../constants/schemas";
import type { Config } from "../types/config";
import { useConfig, type ConfigContextValue } from "./ConfigContext";
import { ConfigProvider } from "./ConfigProvider";

// A stand-in for the device layer: commands go to `device`, events are
// emitted by the test.
const mock = vi.hoisted(() => {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  return {
    listeners,
    device: vi.fn<(command: string) => Promise<unknown>>(),
    readConfig: vi.fn(),
    emit: (type: string, payload?: unknown) => listeners.get(type)?.forEach((fn) => fn(payload)),
  };
});

vi.mock("../device/ota", () => {
  const on = (type: string, fn: (payload: unknown) => void) => {
    if (!mock.listeners.has(type)) mock.listeners.set(type, new Set());
    mock.listeners.get(type)!.add(fn);
    return () => mock.listeners.get(type)!.delete(fn);
  };
  const ota = {
    send: (command: string) => mock.device(command),
    readConfig: () => mock.readConfig(),
    isConnected: () => true,
    close: async () => {},
    on,
  };
  return { default: ota, on };
});

let ctx: ConfigContextValue;
const Probe = () => {
  const value = useConfig();
  useEffect(() => {
    ctx = value;
  });
  return null;
};

const sent = () => mock.device.mock.calls.map(([command]) => command);

async function connect(config: Config = structuredClone(CONFIG_DATA)) {
  mock.readConfig.mockResolvedValue({ config });
  render(
    <ConfigProvider>
      <Probe />
    </ConfigProvider>,
  );
  await act(async () => mock.emit("connect"));
  mock.device.mockClear();
}

beforeEach(() => {
  mock.listeners.clear();
  mock.device.mockReset();
  mock.device.mockResolvedValue("");
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ConfigProvider", () => {
  it("rolls a change back when the device rejects it", async () => {
    await connect();
    mock.device.mockRejectedValueOnce(new Error("NACK"));
    let ok: boolean | undefined;
    await act(async () => {
      ok = await ctx.updateConfig(["profiles", 0, "pointer", "scale_x"], 3);
    });
    expect(ok).toBe(false);
    expect(ctx.data?.profiles[0].pointer).toMatchObject({ scale_x: 1 });
  });

  it("gives back-to-back adds their own indices", async () => {
    await connect();
    await act(async () => {
      await Promise.all([ctx.addConfigItem(["profiles"]), ctx.addConfigItem(["profiles"])]);
    });
    expect(sent().map((c) => c.split(" ").slice(0, 3).join(" "))).toEqual([
      "config set /profiles/3",
      "config set /profiles/4",
    ]);
    expect(ctx.data?.profiles).toHaveLength(5);
  });

  it("deletes an action, then re-points the bindings that referenced it or later ones", async () => {
    await connect();
    await act(async () => {
      await ctx.deleteAction(1); // "Left Click"
    });
    const commands = sent();
    expect(commands[0]).toMatch(/^config set \/global_info\/action_list /);
    expect(commands).toContain("config set /profiles/0/tapper/bindings [0,0,1,3]");
    expect(commands).toContain("config set /profiles/0/gesture/bindings [0,0,0,0,5,0,7,0]");
    expect(ctx.data?.profiles[0].tapper).toMatchObject({ bindings: [0, 0, 1, 3] });
    expect(ctx.actionList.map((a) => a.label)).not.toContain("Left Click");
  });

  it("re-points the profile map after deleting a profile, if the firmware didn't", async () => {
    await connect();
    mock.device.mockImplementation(async (command) =>
      command === "config get /global_info/profile_map" ? [0, 1, 2] : "",
    );
    await act(async () => {
      await ctx.deleteConfigItem(["profiles", 1]);
    });
    expect(sent()).toEqual([
      "config set /profiles/1 null",
      "config get /global_info/profile_map",
      "config set /global_info/profile_map [0,0,1]",
    ]);
    expect(ctx.data?.global_info.profile_map).toEqual([0, 0, 1]);
  });

  it("adopts the firmware's profile map when it already changed it", async () => {
    await connect();
    mock.device.mockImplementation(async (command) =>
      command === "config get /global_info/profile_map" ? [0, 0, 1] : "",
    );
    await act(async () => {
      await ctx.deleteConfigItem(["profiles", 1]);
    });
    expect(sent()).not.toContain("config set /global_info/profile_map [0,0,1]");
    expect(ctx.data?.global_info.profile_map).toEqual([0, 0, 1]);
  });

  it("rejects a restore file that isn't a config", async () => {
    await connect();
    await act(async () => {
      await ctx.replaceConfig({ hello: "world" });
    });
    expect(sent()).toEqual([]);
    expect(ctx.data?.profiles).toHaveLength(3);
  });

  it("removes device profiles the backup doesn't have, last first", async () => {
    await connect();
    const backup = structuredClone(CONFIG_DATA);
    backup.profiles = backup.profiles.slice(0, 1);
    await act(async () => {
      await ctx.replaceConfig(backup);
    });
    expect(sent().map((c) => c.split(" ").slice(0, 3).join(" "))).toEqual([
      "config set /global_info",
      "config set /profiles/0",
      "config set /profiles/2",
      "config set /profiles/1",
    ]);
    expect(sent().slice(-2).every((c) => c.endsWith(" null"))).toBe(true);
    expect(ctx.data?.profiles).toHaveLength(1);
  });
});
