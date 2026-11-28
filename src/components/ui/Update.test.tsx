// @vitest-environment jsdom
// Installing firmware: Cato restarts as soon as it has the file, so a write
// that ends in an error still counts as installed.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Release } from "../../lib/releases";
import Update from "./Update";

const mock = vi.hoisted(() => ({
  notify: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
  send: vi.fn(async () => ""),
}));

vi.mock("../../lib/notify", async (actual) => ({
  ...(await actual<typeof import("../../lib/notify")>()),
  notify: mock.notify,
}));
vi.mock("../../device/ota", () => ({ default: { send: mock.send } }));
vi.mock("../../lib/releases", async (actual) => ({
  ...(await actual<typeof import("../../lib/releases")>()),
  fetchFirmwareAsset: async () => new Blob(["UF2 firmware"]),
}));

const RELEASE: Release = {
  id: 1,
  name: "v1.0.1",
  tag_name: "v1.0.1",
  published_at: "2026-04-02T00:00:00Z",
  assets: [{ id: 7, name: "cato.uf2", size: 12 }],
};

/** The save dialog hands back a file whose writable fails as given (or not at all). */
function stubSavePicker(writable: Partial<FileSystemWritableFileStream> | DOMException) {
  const picker = vi.fn(async () => ({
    createWritable: async () => {
      // (jsdom's DOMException isn't an Error)
      if (writable instanceof DOMException) throw writable;
      return writable;
    },
  }));
  Object.defineProperty(window, "showSaveFilePicker", { value: picker, configurable: true });
  return picker;
}

async function install() {
  const onClose = vi.fn();
  render(<Update release={RELEASE} onClose={onClose} />);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Download" })));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Install" })));
  return onClose;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Update install", () => {
  it("counts a write that errors as Cato restarts as installed, and closes on Reconnect", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const write = vi.fn(async () => {});
    stubSavePicker({
      write,
      close: async () => {
        throw new DOMException("The file was removed", "NotFoundError");
      },
    });
    const onClose = await install();
    expect(mock.send).toHaveBeenCalledWith("reboot uf2");
    expect(write).toHaveBeenCalled();
    expect(mock.notify.error).not.toHaveBeenCalled();
    expect(mock.notify.success).toHaveBeenCalledWith(expect.stringContaining("click Reconnect when it's back"));
    expect(onClose).toHaveBeenCalled();
  });

  it("reports an error when the file couldn't be opened (nothing reached Cato)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubSavePicker(new DOMException("Not allowed", "NotAllowedError"));
    const onClose = await install();
    expect(mock.notify.error).toHaveBeenCalledWith(expect.stringContaining("Couldn't save the firmware to Cato"));
    expect(mock.notify.success).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("leaves Cato in update mode when the save dialog is cancelled", async () => {
    Object.defineProperty(window, "showSaveFilePicker", {
      value: async () => {
        throw new DOMException("Cancelled", "AbortError");
      },
      configurable: true,
    });
    const onClose = await install();
    expect(mock.notify.info).toHaveBeenCalledWith(expect.stringContaining("Cato is in update mode"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
