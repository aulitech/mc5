import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Installable PWA. The service worker precaches the whole build (the
    // app, the lazy Gestures chunk, the 3D model and standard gesture
    // templates) so MyCato opens offline; the Netlify Functions under /api
    // always go to the network. Updates are offered by PwaUpdater.tsx.
    VitePWA({
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
})
