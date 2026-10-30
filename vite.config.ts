import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Netlify sets CONTEXT for its builds: "production" (main), "branch-deploy"
  // (dev) or "deploy-preview" (PRs). Unset in local builds, which act as
  // production.
  const { CONTEXT = 'production' } = loadEnv(mode, '.', '')
  const offlineApp = CONTEXT === 'production'

  return {
    plugins: [
      react(),
      // Installable PWA. The service worker precaches the whole build (the
      // app, the lazy Gestures chunk, the 3D model and standard gesture
      // templates) so MyCato opens offline; the Netlify Functions under /api
      // always go to the network. Updates are offered by PwaUpdater.tsx.
      //
      // Branch deploys and deploy previews sit behind the Netlify login. A
      // cached app there keeps loading after the login session lapses, while
      // its background update checks get 401s, so it silently never updates.
      // Those builds ship a self-destroying worker instead: it clears the
      // caches, unregisters itself and reloads, so they always load fresh.
      VitePWA({
        selfDestroying: !offlineApp,
        registerType: 'prompt',
        includeManifestIcons: false, // already matched by globPatterns below
        manifest: {
          name: 'MyCato',
          short_name: 'MyCato',
          description: 'Configure your Cato device from the browser.',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#09141b',
          theme_color: '#09141b',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,stl,csv}'],
          navigateFallbackDenylist: [/^\/api\//],
        },
      }),
    ],
    // base: '/MyCato/',
  }
})
