// GET /api/asset?id=<assetId> — download one firmware release asset from the
// private aulitech/z_cato repo. Like releases.ts, the GitHub token
// (GITHUB_TOKEN) stays server-side. GitHub answers asset downloads with a
// redirect to short-lived storage; that URL is fetched without the token.

import type { Config } from "@netlify/functions";

const REPO = "aulitech/z_cato";

export default async (req: Request) => {
  const token = Netlify.env.get("GITHUB_TOKEN");
  if (!token) return new Response("GITHUB_TOKEN is not configured", { status: 500 });

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^\d+$/.test(id)) return new Response("Missing or invalid asset id", { status: 400 });

  const meta = await fetch(`https://api.github.com/repos/${REPO}/releases/assets/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/octet-stream",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "mycato-releases",
    },
    redirect: "manual",
  });

  let res = meta;
  if (meta.status >= 300 && meta.status < 400) {
    const location = meta.headers.get("location");
    if (!location) return new Response("GitHub redirect had no location", { status: 502 });
    res = await fetch(location);
  }
  if (!res.ok || !res.body) return new Response(`GitHub returned ${res.status}`, { status: 502 });

  return new Response(res.body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "private, no-store",
    },
  });
};

export const config: Config = {
  path: "/api/asset",
};
