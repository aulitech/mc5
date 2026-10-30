# Contributing to MyCato

## Branches

| Branch | Purpose | Deploys to |
| ------ | ------- | ---------- |
| `dev`  | Default branch. Every change and Dependabot PR lands here through a PR. | Netlify branch deploy, `https://dev--auli-mc.netlify.app` |
| `main` | Production. Changes arrive only through a `dev` → `main` PR at release time. | `https://mc.AULI.TECH` |
| `feature/…`, `fix/…`, `docs/…`, `release/…` | One change each, branched off `dev`. | Netlify deploy preview of its PR |

Don't commit directly to `dev` or `main`. Only `dev` opens PRs into `main`,
and `dev` is never deleted.

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

## Making a change

Every change goes on its own branch off `dev` and reaches `dev` through a
PR. The PR is what gets Netlify to build a deploy preview of the change.

1. Branch off an up-to-date `dev`:

   ```bash
   git checkout dev && git pull
   git checkout -b feature/short-name   # or fix/…, docs/…
   ```

2. Make your change. Run it with `npm run dev` and a Cato plugged in.
3. Bump the patch version once for the branch (see
   [Version bumps](#version-bumps)).
4. Commit. The pre-commit hook runs every check (see [Testing](#testing)).
5. Push the branch and open a PR **into `dev`**:

   ```bash
   git push -u origin feature/short-name
   gh pr create --base dev
   ```

6. Netlify builds a deploy preview for the PR, at
   `https://deploy-preview-<PR number>--auli-mc.netlify.app`, and rebuilds it
   on every push. Try the change there.
7. Merge the PR with a merge commit. The feature branch can be deleted;
   `dev` can't. Netlify then rebuilds the `dev` branch deploy.

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

- **Every change merged into `dev` bumps the patch version** (1.1.0 →
  1.1.1). Bump once per branch, in its first commit; later commits on the
  same branch don't bump again:

  ```bash
  npm run bump-version   # patch bump; stages package.json and package-lock.json
  git add <your files>
  git commit
  ```

  If another PR bumped `dev` first, merge `dev` into your branch and take
  the next patch number when resolving the `package.json` conflict.

- **Every release (`dev` → `main`) bumps the minor version** (1.1.4 →
  1.2.0) and resets the patch to 0. The bump goes through its own
  `release/X.Y.0` branch and PR into `dev`, just before the release PR (see
  below). Don't patch-bump that branch as well.

Deployed versions reach installed and open copies of the app through the
service worker's "new version available" prompt.

Dependabot PRs merged into `dev` on GitHub don't get a bump. They ship with
the next release.

## Releasing to production

1. With everything for the release merged into `dev`, check the `dev`
   branch deploy, including hardware checks where they apply.
2. Bump the minor version on a release branch and merge it into `dev`:

   ```bash
   git checkout dev && git pull
   git checkout -b release/X.Y.0
   npm run bump-minor
   git commit -m "Bump version to X.Y.0"
   git push -u origin release/X.Y.0
   gh pr create --base dev     # then merge it
   ```

3. Open a PR from `dev` into `main`:
   `gh pr create --base main --head dev`.
4. Wait for the Netlify deploy preview check to pass, and try the preview.
5. Merge with a **merge commit** and keep `dev`:
   `gh pr merge <number> --merge` (no `--delete-branch`).
6. Netlify deploys `main` to production. Check that
   `https://mc.AULI.TECH` serves it: the response header should name
   Netlify, not `GitHub.com` (see the README's one-time DNS setup).

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
| Deploy preview | Each open PR (feature branch → `dev`, or `dev` → `main`) | `https://deploy-preview-<PR number>--auli-mc.netlify.app` | Netlify team login |

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
