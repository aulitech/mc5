// @vitest-environment jsdom
// Smoke test: the whole app, connected to a fake Cato, renders each tab and
// the action editor without throwing.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { CONFIG_DATA } from "../../constants/schemas";

const mock = vi.hoisted(() => {
  // Shell checks for these at import time.
  Object.defineProperty(navigator, "hid", { value: {}, configurable: true });
  Object.defineProperty(window, "showOpenFilePicker", { value: () => {}, configurable: true });
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  return {
    listeners,
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
    readConfig: async () => ({ config: structuredClone(CONFIG_DATA) }),
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

describe("Shell", () => {
  it("renders every tab for a connected Cato", async () => {
    render(<App />);
    await act(async () => {
      mock.emit("connect", { productName: "Cato 1234", info: { gesture_list: GESTURES, version: { string: "1.0.0" } } });
    });

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
});
