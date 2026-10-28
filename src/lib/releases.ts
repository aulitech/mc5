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

export async function fetchLatestReleases(): Promise<Release[]> {
  const res = await fetch("/api/releases");
  if (!res.ok) throw new Error(`Release check failed (${res.status})`);
  return res.json();
}

export async function fetchFirmwareAsset(asset: ReleaseAsset): Promise<Blob> {
  const res = await fetch(`/api/asset?id=${encodeURIComponent(asset.id)}`);
  if (!res.ok) throw new Error(`Firmware download failed (${res.status})`);
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
