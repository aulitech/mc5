import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFirmwareAsset, fetchLatestReleases } from "./releases";

const reply = (body: string, status: number, contentType: string) =>
  vi.stubGlobal("fetch", async () => new Response(body, { status, headers: { "Content-Type": contentType } }));

afterEach(() => vi.unstubAllGlobals());

describe("release errors", () => {
  it("pass on the function's own reason", async () => {
    reply("GITHUB_TOKEN is not configured", 500, "text/plain;charset=UTF-8");
    await expect(fetchLatestReleases()).rejects.toThrow("Release check failed (500): GITHUB_TOKEN is not configured");
    await expect(fetchFirmwareAsset({ id: 1, name: "a.uf2", size: 1 })).rejects.toThrow(
      "Firmware download failed (500): GITHUB_TOKEN is not configured",
    );
  });

  it("leave out an HTML error page", async () => {
    reply("<!DOCTYPE html><title>Page not found</title>", 404, "text/html; charset=utf-8");
    await expect(fetchLatestReleases()).rejects.toThrow(/^Release check failed \(404\)$/);
  });

  it("say where the release check runs when it isn't there", async () => {
    reply("<!doctype html><div id=root></div>", 200, "text/html");
    await expect(fetchLatestReleases()).rejects.toThrow("/api/releases isn't available here (it runs on Netlify).");
  });

  it("return the releases when the function answers", async () => {
    const releases = [{ id: 1, name: "v1.0.1", tag_name: "v1.0.1", published_at: "", assets: [] }];
    reply(JSON.stringify(releases), 200, "application/json");
    await expect(fetchLatestReleases()).resolves.toEqual(releases);
  });
});
