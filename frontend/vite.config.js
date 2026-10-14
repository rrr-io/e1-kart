import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// The game is served at the root of a subdomain (e.g. e1kart.rrriooo.com), hence base '/'.
export default defineConfig({
  base: '/',
  // In development, /api calls go to the local Spring Boot backend.
  server: { proxy: { '/api': 'http://localhost:8080' } },
  preview: { proxy: { '/api': 'http://localhost:8080' } },
  build: {
    target: 'es2019',
    chunkSizeWarningLimit: 900,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'E1 Kart GP',
        short_name: 'E1 Kart',
        description: 'E1-themed night kart racer: 6 teams, drifts and lightstick boost under the blue moon.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#0b0b0d',
        theme_color: '#0b0b0d',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,woff,woff2}'],
        // API calls never go through the service worker cache.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
});
