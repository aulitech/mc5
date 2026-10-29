# MyCato

## Project Overview
MyCato is a React-based configuration UI for the Cato device. It uses recursive JSON node rendering to allow users to build and edit device configurations. This project aims to build out the "Gestures" tab by adding all features from the Gesture Collection app at: "C:\Repositories\expense-tracker"

These are the features that should be incorporated into the "Gestures" tab of MyCato from expense-tracker:

1. Gesture Collection - Users collect and save IMU gesture data (current expense-tracker location: GestureControl, Gesture Inputs, Gesture Summary, gesture-collection)
2. Gesture Visulization - A 3d visualization of each gesture class (current expense-tracker location: GestureVisualizer)
3. Cross Correlation Template generation - Generating an averaged gesture template for each class in .csv format for later use in cross correlation (dashboard.js)

NOTE: Do not use the bluetooth connection or firebase storage protocols from expense-tracker.
- Do NOT use the expense-tracker BluetoothConnector.js. Instead, the sensor stream should already be available to the Gestures tab via handleSensorStream and sensorHandler. Use this as the source of IMU data.
- Do NOT use firebase for data/gesture storage or authentication. No authentication needed. Use Google IndexedDB for data/gesture storage.


### Top-Level Structure
```
mc5/                # MyCato — React app (Vite + TypeScript, strict; no .jsx)
├── netlify.toml    # Netlify build (publish dist)
├── netlify/functions/  # releases.ts (/api/releases), asset.ts (/api/asset firmware
│                       # download) — server-side GitHub calls (GITHUB_TOKEN)
├── scripts/        # Utility scripts (ExportSrc.sh)
└── src/
    ├── App.tsx             # Root — Settings → Device → Config → Dialog providers, then Shell
    ├── device/
    │   ├── ota.ts          # WebHID transport: queued send(), connect/readConfig/close, on(event)
    │   ├── protocol.ts     # Pure report encode/decode (unit tested)
    │   └── useOtaEvent.ts  # Subscribe to device events from components
    ├── context/            # SettingsContext, DeviceContext, ConfigContext, DialogContext (+ *Provider.tsx)
    ├── lib/                # notify (toasts), configPath, configEdits (index remaps on delete,
    │                       # backup validation), leafValue, configFile (backup/restore), releases
    ├── types/              # device.ts, config.ts, gestures.ts
    ├── features/gestures/  # Gestures tab: components/, data/ (IndexedDB, standard gestures),
    │                       # lib/templateGen.ts, hooks/ (sensor stream/recorder), state/ (store)
    ├── components/
    │   ├── ui/             # Shell (tab registry), Toaster, HoverClickButton, base UI chrome
    │   ├── tabs/           # Top-level tab views
    │   ├── tree/           # Recursive JSON node tree rendering (custom editors registered in JsonNodeRenderer)
    │   ├── tools/          # Toolbar/action components
    │   ├── modals/         # Modal dialogs
    │   └── help/           # Help content
    ├── utils/              # helpers.tsx, schema.ts (getSchema)
    └── constants/
        ├── mappings.ts     # Key/value mappings
        └── schemas.ts      # UI schema + defaults — plain data, no React/device imports
```

### Branches
- **`dev`** — default branch; all work and Dependabot PRs land here.
- **`main`** — production: Netlify deploys it to mc.AULI.TECH. Changes reach it only through a `dev` → `main` PR at release time.
- Versions: patch bump on every commit to `dev`, minor bump when releasing to `main`. Details in CONTRIBUTING.md.

### Key Concepts
- **Device layer** — `device/ota.ts` owns the HID connection. `send()` calls are queued (never "Send in progress"); status/sensor/practice reports are events (`useOtaEvent`). It holds no config.
- **DeviceContext / ConfigContext** — device + status vs. config data. `setConfigValue` edits locally; `updateConfig` edits and sends, rolling back if the device rejects it.
- **Indices in the config** — action bindings point into `action_list` and `profile_map` into `profiles`. Delete actions with `deleteAction` and profiles with `deleteConfigItem`, which re-point them; don't splice those arrays directly.
- **Recursive tree rendering** — components in `tree/` render JSON nodes recursively from `UI_SCHEMA(gestureNames)`.
- **Errors and confirmations** — use `notify` (lib/notify.ts) and `useDialog()`, not `alert`/`confirm`/`prompt`.
- **Colours** — use the theme tokens in `styles/index.css` (each has a light and a dark value), never hex literals in components. `npm run contrast` checks every token pairing against WCAG (4.5:1 text, 3:1 UI); add a pair to `scripts/contrast-audit.mjs` for any new combination.
- **Checks** — `npm run typecheck`, `npm run lint`, `npm test`, `npm run contrast` (all in the pre-commit hook); `npm run build` runs the typecheck first. Component tests use jsdom (`// @vitest-environment jsdom`); IndexedDB tests use `fake-indexeddb`.
