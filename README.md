# MyCato

Browser-based configuration tool for the Cato device. It talks to Cato over
WebHID, so it needs Chrome or Edge.

## Development

```bash
npm install
npm run dev        # Vite dev server
npm run typecheck  # tsc, strict
npm run lint
npm test           # Vitest unit tests
npm run contrast   # WCAG contrast check of the light/dark theme colours
npm run build      # typecheck + production build into dist/
```

`npm run dev` doesn't serve the Netlify Functions, so **Manage → Check for
Updates** returns 404 there. To test it locally, run `npx netlify dev` with
`GITHUB_TOKEN` set.

The pre-commit hook runs typecheck, lint, tests and the contrast check.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branch → `dev` → `main` workflow, version
bumps and Netlify deploys.

## Installing as an app (PWA)

MyCato is a Progressive Web App. In Chrome or Edge, use the install icon in
the address bar (or the browser menu's **Install MyCato**) to add it as a
desktop app. After the first visit it opens offline, too. Everything except
**Check for Updates** and the firmware download works without a network.

When a new version is deployed, MyCato shows a "new version available" toast
with a **Reload** button. Nothing reloads by itself, because a reload drops
the connection to Cato.

## Deployment (Netlify)

Netlify builds from `netlify.toml` (`npm run build`, publishes `dist`). Pushes to `main` deploy to production, `dev` has a branch deploy, and pull
requests get deploy previews (see [CONTRIBUTING.md](CONTRIBUTING.md#netlify-deployments)).

One-time setup in the Netlify UI:

1. **Environment variable `GITHUB_TOKEN`**: a fine-grained GitHub token with
   read-only *Contents* access to `aulitech/z_cato`. It is used only by
   `netlify/functions/releases.ts` (`/api/releases`) and
   `netlify/functions/asset.ts` (`/api/asset`, the firmware download), and
   never reaches the browser.
2. **Custom domain `mc.AULI.TECH`**: add it under Domain management, then
   point the DNS record at Netlify in place of GitHub Pages.

## Layout

```
src/
  device/        WebHID transport (ota.ts), pure protocol encode/decode, useOtaEvent
  context/       Settings, Device, Config and Dialog providers + hooks
  lib/           notify (toasts), config path helpers, backup/restore files, releases
  types/         Shared types: device reports, config, gestures
  features/
    gestures/    Gestures tab: IndexedDB storage, template generation, store, components
  components/    Shell, tabs, recursive config tree, modals, tools; ui/PwaUpdater
                 registers the service worker and offers updates
  constants/     mappings and the UI schema (plain data)
netlify/functions/releases.ts   Server-side firmware release lookup
netlify/functions/asset.ts      Server-side firmware download
```
