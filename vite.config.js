import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Precache the actual built asset list (hashed filenames and all) at
      // build time — a hand-rolled service worker can't reliably do this
      // itself, since it has no way to know those hashes ahead of time and
      // doesn't control the very page that first registers it anyway. This
      // is purely an app-shell cache: nothing here touches Supabase
      // requests or the app's own Dexie/sync data layer.
      registerType: 'autoUpdate',
      injectRegister: false,
      // No runtimeCaching entries are configured, so Supabase (a different
      // origin entirely) is never touched by this service worker — the
      // generated worker only ever precaches this app's own same-origin
      // build output.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // This is an SPA with client-side routing (react-router) — a fresh
        // offline navigation to e.g. /inventory or /reports is a real HTTP
        // navigation request for a path that was never itself built as a
        // file, so without an explicit fallback it 404s instead of loading
        // the shell and letting the router take over. Send every same-origin
        // navigation that isn't a precached file to the cached index.html.
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [/^(?!\/__).*/],
      },
      manifest: {
        name: 'Mr YUM POS',
        short_name: 'Mr YUM',
        start_url: '/',
        display: 'standalone',
        theme_color: '#07191E',
        background_color: '#07191E',
        icons: [],
      },
    }),
  ],
})
