import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // GitHub Pages serves the app from https://<login>.github.io/sprawunki/
  base: '/sprawunki/',
  plugins: [
    VitePWA({
      // The new service worker activates as soon as it is installed, without asking.
      // The open page keeps running the old version; the next launch gets the new one.
      registerType: 'autoUpdate',
      // Adds a small registerSW.js to index.html that only registers the service worker.
      // (The alternative, importing 'virtual:pwa-register', would also reload the page
      // on update, which could interrupt someone in the middle of shopping.)
      injectRegister: 'script',
      // Public files not referenced from the code that must still work offline.
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Sprawunki — lista zakupów',
        short_name: 'Sprawunki',
        description: 'Prosta lista zakupów działająca offline.',
        lang: 'pl',
        display: 'standalone',
        start_url: '/sprawunki/',
        scope: '/sprawunki/',
        // Same as the page background (--color-bg), so the status bar blends in.
        theme_color: '#f5f6f3',
        background_color: '#f5f6f3',
        // Paths are relative to the manifest file, which lives in /sprawunki/.
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // The artwork is drawn inside the maskable "safe zone", so the same file works
          // when Android crops it to a circle or another shape.
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.js'],
  },
});
