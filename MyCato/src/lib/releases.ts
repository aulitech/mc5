// releases.ts — Firmware release lookup. The firmware repo is private, so the
// GitHub call happens server-side in netlify/functions/releases.ts, which
// holds the token; the browser only ever talks to /api/releases.

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
