import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// The version is set in one place, package.json, and shown in the settings (spec 12.3).
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  // GitHub Pages serves the app from https://<login>.github.io/sprawunki/
  base: '/sprawunki/',
  // Vite replaces __APP_VERSION__ in the code with this text, both in `npm run dev`
  // and in the build. JSON.stringify adds the quotes, so the code gets '2.2.0'.
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
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
      includeAssets: ['favicon.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Sprawunki — lista zakupów',
        short_name: 'Sprawunki',
        description: 'Prosta lista zakupów działająca offline.',
        lang: 'pl',
        display: 'standalone',
        start_url: '/sprawunki/',
        scope: '/sprawunki/',
        // The splash screen Android shows at start (spec 12.4): the icon's flat background
        // (the accent color, see design/icon.svg), so the icon blends into a fully blue screen
        // with a white bag, in both themes. The status bar matches it during the splash; after the start
        // it takes the theme's color from the theme-color tags in index.html (spec 12.2).
        theme_color: '#2f6f9e',
        background_color: '#2f6f9e',
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
