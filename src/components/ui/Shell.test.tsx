// @vitest-environment jsdom
// Smoke test: the whole app, connected to a fake Cato, renders each tab and
// the action editor without throwing — or, when Cato's configuration can't
// be read, only the Manage menu and a prompt to update.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CONFIG_DATA } from "../../constants/schemas";

const mock = vi.hoisted(() => {
  // Shell checks for these at import time.
  Object.defineProperty(navigator, "hid", { value: {}, configurable: true });
  Object.defineProperty(window, "showOpenFilePicker", { value: () => {}, configurable: true });
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  return {
    listeners,
    /** Set to make the fake Cato's readConfig answer differently. */
    readConfig: null as null | (() => Promise<unknown>),
    emit: (type: string, payload?: unknown) => listeners.get(type)?.forEach((fn) => fn(payload)),
  };
});

vi.mock("../../device/ota", () => {
  const on = (type: string, fn: (payload: unknown) => void) => {
    if (!mock.listeners.has(type)) mock.listeners.set(type, new Set());
    mock.listeners.get(type)!.add(fn);
    return () => mock.listeners.get(type)!.delete(fn);
  };
  const ota = {
    send: async () => "",
    readConfig: async () => (mock.readConfig ? mock.readConfig() : { config: structuredClone(CONFIG_DATA) }),
    isConnected: () => true,
    close: async () => {},
    connect: async () => null,
    on,
  };
  return { default: ota, on };
});

import App from "../../App";

const GESTURES = ["Idle", "Movement", "Nod Up", "Nod Down", "Nod Left", "Nod Right", "Tilt Left", "Tilt Right"];

beforeAll(() => {
  window.matchMedia ??= (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;
});

afterEach(() => {
  cleanup();
  mock.readConfig = null;
});

const connectCato = () =>
  act(async () => {
    mock.emit("connect", { productName: "Cato 1234", info: { gesture_list: GESTURES, version: { string: "1.0.0" } } });
  });

describe("Shell", () => {
  it("renders every tab for a connected Cato", async () => {
    render(<App />);
    await connectCato();

    // General
    expect(screen.getByText("Device Configuration")).toBeTruthy();

    // Profile (advanced on, to show every profile and the add button)
    fireEvent.click(screen.getByRole("checkbox", { name: "Advanced" }));
    fireEvent.click(screen.getByRole("button", { name: "Profile" }));
    expect(screen.getByText("Add Profile")).toBeTruthy();
    expect(screen.getAllByText("Stretch").length).toBeGreaterThan(0);

    // Action: open and cancel the editor, open the new-action draft
    fireEvent.click(screen.getByRole("button", { name: "Action" }));
    expect(screen.getByText(`Actions (${CONFIG_DATA.global_info.action_list.length})`)).toBeTruthy();
    fireEvent.click(screen.getAllByTitle("Edit action")[1]);
    expect(screen.getByLabelText("Action label")).toBeTruthy();
    fireEvent.click(screen.getByTitle("Cancel"));
    fireEvent.click(screen.getByText("New Action"));
    expect(screen.getByPlaceholderText("New Action")).toBeTruthy();

    // Practice, Tools
    fireEvent.click(screen.getByRole("button", { name: "Practice" }));
    expect(screen.getByText("Available gestures on this device:")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tools" }));
    expect(screen.getByText("Test Tools")).toBeTruthy();
  });

  it("offers only the Manage menu and a firmware update when the configuration can't be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.readConfig = async () => {
      throw new Error("Cato didn't send its global settings.");
    };
    render(<App />);
    await connectCato();

    expect(screen.getByText("Cato's configuration couldn't be read")).toBeTruthy();
    expect(screen.getByText("Cato didn't send its global settings.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Update firmware" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "General" })).toBeNull(); // no tabs

    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent);
    expect(items).toContain("Check for Updates");
    expect(items).not.toContain("Backup"); // nothing to back up

    // Try again, and this time it reads: the tabs are back.
    mock.readConfig = null;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    expect(screen.queryByText("Cato's configuration couldn't be read")).toBeNull();
    expect(screen.getByRole("button", { name: "General" })).toBeTruthy();
  });

  it("treats a configuration with a profile it couldn't read as unread", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.readConfig = async () => ({ config: structuredClone(CONFIG_DATA), unreadProfile: 2 });
    render(<App />);
    await connectCato();
    expect(screen.getByText("Profile 3 couldn't be read.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "General" })).toBeNull();
  });
});
