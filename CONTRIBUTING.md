# Contributing to MyCato

## Branches

| Branch | Purpose | Deploys to |
| ------ | ------- | ---------- |
| `dev`  | Default branch. All work and Dependabot PRs land here. | Netlify branch deploy, `https://dev--auli-mc.netlify.app` |
| `main` | Production. Changes arrive only through a `dev` → `main` PR at release time. | `https://mc.AULI.TECH` |

Don't commit to `main` or open PRs into it from any branch but `dev`, and
don't delete `dev` when merging a release.

## Setup

You need Node 22 (Netlify builds with it) and Chrome or Edge, because MyCato
talks to Cato over WebHID.

```bash
git clone https://github.com/aulitech/mc5.git
cd mc5
git checkout dev
npm install        # also installs the pre-commit hook
npm run dev        # Vite dev server at http://localhost:5173
```

## Developing on `dev`

1. Start from an up-to-date `dev`: `git checkout dev && git pull`.
2. Make your change. Run it with `npm run dev` and a Cato plugged in.
3. Bump the patch version (see [Version bumps](#version-bumps)).
4. Commit. The pre-commit hook runs every check (see [Testing](#testing)).
5. Push `dev`. Netlify rebuilds the `dev` branch deploy, where you can try
   the change before it's released.

Small changes can go straight to `dev`. For larger ones, or if you don't
have push access, work on a branch off `dev` and open a PR **into `dev`**.
Netlify builds a deploy preview for that PR.

Project conventions are in [CLAUDE.md](CLAUDE.md) under "Key Concepts", for
example how to handle errors and confirmations, theme colour tokens, and
config index remapping.

## Testing

| Command | What it checks |
| ------- | -------------- |
| `npm run typecheck` | TypeScript, strict |
| `npm run lint` | ESLint, including React hooks rules |
| `npm test` | Vitest unit and component tests |
| `npm run contrast` | WCAG contrast of every theme colour pairing, light and dark |
| `npm run build` | Typecheck, then a production build into `dist/` |

The pre-commit hook runs the first four checks, and a commit fails if any of
them fails. Don't skip it with `--no-verify`.

- **Writing tests**: put tests next to the code as `*.test.ts(x)`.
  - Component tests start with `// @vitest-environment jsdom` and use
    `@testing-library/react`.
  - IndexedDB code is tested with `fake-indexeddb`.
  - The pure device protocol (`src/device/protocol.ts`) has its own unit
    tests. Keep them passing when you touch report encoding or decoding.
- **New colour pairings**: if you add a new foreground/background
  combination, add it to `scripts/contrast-audit.mjs`. Use 4.5:1 for text
  and 3:1 for UI parts.
- **Hardware**: the automated tests don't cover the device. Before a
  release, try anything touching `src/device/`, config editing, firmware
  update or the Gestures tab against a real Cato.
- **PWA and offline**: the service worker exists only in production builds,
  not under `npm run dev`. To test installing, offline use or the update
  prompt, run `npm run build && npm run preview` (http://localhost:4173).
  - In Chrome DevTools, use **Application → Service workers** with
    **Offline** ticked.
  - To see the update prompt, rebuild while the preview page is open, then
    reload it once.
  - Files added to `public/` are precached automatically if their extension
    matches `globPatterns` in [vite.config.ts](vite.config.ts). Add the
    extension there if it doesn't.
- **Netlify Functions**: `npm run dev` doesn't serve the functions
  (`/api/releases`, `/api/asset`), so **Manage → Check for Updates** returns
  404 there. To test them locally, run `npx netlify dev` with `GITHUB_TOKEN`
  set, or use the `dev` branch deploy.

## Version bumps

The version in `package.json` follows two rules:

Deployed versions reach installed and open copies of the app through the
service worker's "new version available" prompt.

- **Every commit to `dev` bumps the patch version** (1.0.9 → 1.0.10). Make
  the bump part of the same commit:

  ```bash
  npm run bump-version   # patch bump; stages package.json and package-lock.json
  git add <your files>
  git commit
  ```

- **Every release (`dev` → `main`) bumps the minor version** (1.0.12 →
  1.1.0) and resets the patch to 0. The bump is its own commit on `dev`,
  made just before the release PR (see below). Don't patch-bump that commit
  as well.

Dependabot PRs merged into `dev` on GitHub don't get a bump. They ship with
the next release.

## Releasing to production

1. On `dev`, with everything for the release committed and pushed, check the
   `dev` branch deploy, including hardware checks where they apply.
2. Bump the minor version and push:

   ```bash
   npm run bump-minor
   git commit -m "Bump version to X.Y.0"
   git push origin dev
   ```

3. Open a PR from `dev` into `main`:
   `gh pr create --base main --head dev`.
4. Wait for the Netlify deploy preview check to pass, and try the preview.
5. Merge with a **merge commit** and keep the branch:
   `gh pr merge <number> --merge` (no `--delete-branch`).
6. Netlify deploys `main` to `https://mc.AULI.TECH`.

After the merge, `main` is one merge commit ahead of `dev`. That's expected
and needs no action.

## Netlify deployments

Netlify builds every deploy from [netlify.toml](netlify.toml):
`npm run build` on Node 22, publishing `dist/`, with the functions in
`netlify/functions/`. The site is `auli-mc`.

| Context | Built from | URL | Access |
| ------- | ---------- | --- | ------ |
| Production | `main` | `https://mc.AULI.TECH` (also `auli-mc.netlify.app`) | Public |
| Branch deploy | `dev` | `https://dev--auli-mc.netlify.app` | Netlify team login |
| Deploy preview | Each open PR | `https://deploy-preview-<PR number>--auli-mc.netlify.app` | Netlify team login |

- **When builds run**: every push to `dev` updates the branch deploy, and
  every push to a PR updates its preview. Only merging into `main` changes
  production.
- **Access**: the non-production deploys are password-protected, so log in
  to the `auli-mc` Netlify team to open them.
- **GitHub token**: the functions read the `GITHUB_TOKEN` environment
  variable (read-only *Contents* access to `aulitech/z_cato`). For firmware
  update checks to work on the branch deploy and on deploy previews, not
  just in production, it must be set for those deploy contexts as well (Site
  settings → Environment variables). The token never reaches the browser.

## Dependencies

Dependabot is configured in
[.github/dependabot.yml](.github/dependabot.yml) and opens PRs against
`dev`:

- weekly version updates, with minor and patch updates grouped into one PR;
- security updates, which go to the default branch (`dev`).

Merge them into `dev` once their checks pass, and they ship with the next
release.

## Reporting security issues

See [SECURITY.md](SECURITY.md). Report vulnerabilities privately, not in
public issues.
