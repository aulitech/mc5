// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dismiss, getToasts, notify } from "../../lib/notify";
import Toaster from "./Toaster";

afterEach(() => {
  cleanup();
  act(() => getToasts().forEach((t) => dismiss(t.id)));
  vi.useRealTimers();
});

describe("Toaster", () => {
  it("runs a toast's action and dismisses it", () => {
    const onClick = vi.fn();
    render(<Toaster />);
    act(() => notify.info("Update ready", { action: { label: "Reload", onClick } }));

    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.queryByText("Update ready")).toBeNull();
  });

  it("keeps a persistent toast past the auto-dismiss time", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => {
      notify.info("Stays", { persist: true });
      notify.info("Goes");
    });

    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText("Stays")).toBeTruthy();
    expect(screen.queryByText("Goes")).toBeNull();
  });
});
