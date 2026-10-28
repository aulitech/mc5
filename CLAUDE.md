# MC3 — MyCato (v3)

## Project Overview
MyCato is a React-based configuration UI for the Cato device. It uses recursive JSON node rendering to allow users to build and edit device configurations. This project aims to build out the "Gestures" tab by adding all features from the Gesture Collection app at: "C:\Repositories\expense-tracker"

These are the features that should be incorporated into the "Gestures" tab of mc3 from expense-tracker:

1. Gesture Collection - Users collect and save IMU gesture data (current expense-tracker location: GestureControl, Gesture Inputs, Gesture Summary, gesture-collection)
2. Gesture Visulization - A 3d visualization of each gesture class (current expense-tracker location: GestureVisualizer)
3. Cross Correlation Template generation - Generating an averaged gesture template for each class in .csv format for later use in cross correlation (dashboard.js)

NOTE: Do not use the bluetooth connection or firebase storage protocols from expense-tracker.
- Do NOT use the expense-tracker BluetoothConnector.js. Instead, the sensor stream should already be available to the Gestures tab via handleSensorStream and sensorHandler. Use this as the source of IMU data.
- Do NOT use firebase for data/gesture storage or authentication. No authentication needed. Use Google IndexedDB for data/gesture storage.


### Top-Level Structure
```
mc3/
├── netlify.toml    # Netlify build (base MyCato, publish dist)
├── MyCato/         # Main React app (Vite + TypeScript, .jsx still allowed)
│   ├── netlify/functions/releases.ts  # /api/releases — server-side GitHub lookup (GITHUB_TOKEN)
│   └── src/
│       ├── App.tsx             # Root — Settings → Device → Config → Dialog providers, then Shell
│       ├── device/
│       │   ├── ota.ts          # WebHID transport: queued send(), connect/readConfig/close, on(event)
│       │   ├── protocol.ts     # Pure report encode/decode (unit tested)
│       │   └── useOtaEvent.ts  # Subscribe to device events from components
│       ├── context/            # SettingsContext, DeviceContext, ConfigContext, DialogContext (+ *Provider.tsx)
│       ├── lib/                # notify (toasts), configPath, configFile (backup/restore), releases
│       ├── types/              # device.ts, config.ts, gestures.ts
│       ├── features/gestures/  # Gestures tab: components/, data/ (IndexedDB, standard gestures),
│       │                       # lib/templateGen.ts, hooks/ (sensor stream/recorder), state/ (store)
│       ├── components/
│       │   ├── ui/             # Shell (tab registry), Toaster, HoverClickButton, base UI chrome
│       │   ├── tabs/           # Top-level tab views
│       │   ├── tree/           # Recursive JSON node tree rendering (custom editors registered in JsonNodeRenderer)
│       │   ├── tools/          # Toolbar/action components
│       │   ├── modals/         # Modal dialogs
│       │   └── help/           # Help content
│       ├── utils/              # helpers.jsx, schema.ts (getSchema)
│       └── constants/
│           ├── mappings.jsx    # Key/value mappings
│           └── schemas.ts      # UI schema + defaults — plain data, no React/device imports
├── scripts/        # Build or utility scripts
└── package.json    # Root-level deps (lucide-react)
```

### Key Concepts
- **Device layer** — `device/ota.ts` owns the HID connection. `send()` calls are queued (never "Send in progress"); status/sensor/practice reports are events (`useOtaEvent`). It holds no config.
- **DeviceContext / ConfigContext** — device + status vs. config data. `setConfigValue` edits locally; `updateConfig` edits and sends, rolling back if the device rejects it.
- **Recursive tree rendering** — components in `tree/` render JSON nodes recursively from `UI_SCHEMA(gestureNames)`.
- **Errors and confirmations** — use `notify` (lib/notify.ts) and `useDialog()`, not `alert`/`confirm`/`prompt`.
- **Checks** — `npm run typecheck`, `npm run lint`, `npm test`; `npm run build` runs the typecheck first.
