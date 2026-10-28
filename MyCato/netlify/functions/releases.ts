// GET /api/releases — latest firmware release from the private aulitech/z_cato
// repo. Runs server-side so the GitHub token (GITHUB_TOKEN, set in Netlify's
// environment variables) never reaches the browser. Only the fields the
// update screen needs are passed through.

import type { Config } from "@netlify/functions";

interface GitHubAsset {
  id: number;
  name: string;
  size: number;
}

interface GitHubRelease {
  id: number;
  name: string;
  tag_name: string;
  published_at: string;
  assets: GitHubAsset[];
}

export default async () => {
  const token = Netlify.env.get("GITHUB_TOKEN");
  if (!token) return new Response("GITHUB_TOKEN is not configured", { status: 500 });

  const res = await fetch("https://api.github.com/repos/aulitech/z_cato/releases?per_page=1", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "mycato-releases",
    },
  });
  if (!res.ok) return new Response(`GitHub returned ${res.status}`, { status: 502 });

  const releases = (await res.json()) as GitHubRelease[];
  const slim = releases.map(({ id, name, tag_name, published_at, assets }) => ({
    id,
    name,
    tag_name,
    published_at,
    assets: assets.map(({ id, name, size }) => ({ id, name, size })),
  }));

  return Response.json(slim, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
};

export const config: Config = {
  path: "/api/releases",
};
