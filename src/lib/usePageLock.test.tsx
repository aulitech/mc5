// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { usePageLock } from "./usePageLock";

// A page: a header, a toast region, and main holding a sidebar and the kept
// element (with a child, which stays usable along with it).
function Page({ locked, dim }: { locked: boolean; dim?: boolean }) {
  usePageLock(locked, () => document.getElementById("kept"), { dim });
  return (
    <>
      <header id="header" />
      <div id="toasts" aria-live="polite" />
      <main id="main">
        <nav id="sidebar" />
        <div id="kept">
          <button id="inside" />
        </div>
      </main>
    </>
  );
}

const el = (id: string) => document.getElementById(id)!;

afterEach(cleanup);

describe("usePageLock", () => {
  it("makes everything but the kept element inert and dimmed, and undoes it when unlocked", () => {
    const { rerender } = render(<Page locked />);
    for (const id of ["header", "sidebar"]) {
      expect(el(id).inert).toBe(true);
      expect(el(id).classList.contains("page-locked")).toBe(true);
    }
    for (const id of ["kept", "inside", "main", "toasts"]) expect(el(id).inert).toBeFalsy();

    rerender(<Page locked={false} />);
    for (const id of ["header", "sidebar"]) {
      expect(el(id).inert).toBe(false);
      expect(el(id).classList.contains("page-locked")).toBe(false);
    }
  });

  it("can lock without dimming (a modal, whose overlay dims the page)", () => {
    render(<Page locked dim={false} />);
    expect(el("header").inert).toBe(true);
    expect(el("header").classList.contains("page-locked")).toBe(false);
  });

  it("leaves alone what was already inert", () => {
    const { rerender } = render(<Page locked={false} />);
    el("header").inert = true;
    rerender(<Page locked />);
    rerender(<Page locked={false} />);
    expect(el("header").inert).toBe(true); // not ours to undo
    expect(el("sidebar").inert).toBe(false);
  });
});
