import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Standalone web build for the .latte viewer/editor. Reuses the renderer's Tiptap
// extension code (../src/renderer/src/*) so the schema stays identical to the app
// and files round-trip losslessly. Output goes to /docs for GitHub Pages, and
// base:'./' keeps asset URLs relative so it works under username.github.io/repo/.
// VitePWA makes it an installable, offline-capable PWA (step 1 toward Android).
export default defineConfig({
  root: 'web',
  base: './',
  // The web entry imports shared modules that live outside web/ (in src/renderer).
  server: { fs: { allow: ['..'] } },
  build: {
    outDir: '../docs',
    emptyOutDir: true
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'LatteWrite',
        short_name: 'LatteWrite',
        description: 'A beautiful, themeable, presentation-first word processor',
        theme_color: '#17100a',
        background_color: '#17100a',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff,woff2}'],
        // Cache Google Fonts so themes still render after the first online load.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ]
})
