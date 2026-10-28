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
npm run build      # typecheck + production build into dist/
```

`npm run dev` doesn't serve the Netlify Functions, so **Manage → Check for
Updates** returns 404 there. To test it locally, run `npx netlify dev` with
`GITHUB_TOKEN` set.

The pre-commit hook runs typecheck, lint and tests. Bump the version when
releasing with `npm run bump-version`.

## Deployment (Netlify)

Netlify builds from `netlify.toml` (`npm run build`, publishes `dist`). Pushes to the production branch deploy automatically, and pull
requests get deploy previews.

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
  components/    Shell, tabs, recursive config tree, modals, tools
  constants/     mappings and the UI schema (plain data)
netlify/functions/releases.ts   Server-side firmware release lookup
netlify/functions/asset.ts      Server-side firmware download
```
