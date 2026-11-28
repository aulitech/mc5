// releases.ts — Firmware release lookup and download. The firmware repo is
// private, so the GitHub calls happen server-side in netlify/functions
// (releases.ts, asset.ts), which hold the token; the browser only ever talks
// to /api/releases and /api/asset.

export interface ReleaseAsset {
  id: number;
  name: string;
  size: number;
}

export interface Release {
  id: number;
  name: string;
  tag_name: string;
  published_at: string;
  assets: ReleaseAsset[];
}

// The functions answer a failure with a short plain-text reason (e.g.
// "GITHUB_TOKEN is not configured"), which the error passes on. Anything else
// (an HTML error page) is left out.
async function failure(res: Response, what: string) {
  const isText = res.headers.get("content-type")?.startsWith("text/plain");
  const reason = isText ? (await res.text().catch(() => "")).trim() : "";
  return new Error(`${what} (${res.status})${reason && reason.length <= 200 ? `: ${reason}` : ""}`);
}

export async function fetchLatestReleases(): Promise<Release[]> {
  const res = await fetch("/api/releases");
  if (!res.ok) throw await failure(res, "Release check failed");
  // Without the Netlify functions (e.g. `npm run dev`), /api/releases is the
  // app's own page.
  if (!res.headers.get("content-type")?.includes("json")) {
    throw new Error("Release check failed: /api/releases isn't available here (it runs on Netlify).");
  }
  return res.json();
}

export async function fetchFirmwareAsset(asset: ReleaseAsset): Promise<Blob> {
  const res = await fetch(`/api/asset?id=${encodeURIComponent(asset.id)}`);
  if (!res.ok) throw await failure(res, "Firmware download failed");
  return res.blob();
}

const normalizeVersion = (v: string) => v.trim().toLowerCase().replace(/^v/, "");

/**
 * Whether the device already runs `release`. Only an exact match (ignoring a
 * leading "v" and case) counts, so an unrecognised version string still
 * offers the update.
 */
export function isInstalled(release: Release, deviceVersion: string | undefined) {
  if (!deviceVersion) return false;
  const installed = normalizeVersion(deviceVersion);
  return installed === normalizeVersion(release.tag_name) || installed === normalizeVersion(release.name ?? "");
}
