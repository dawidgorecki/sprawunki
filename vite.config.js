import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves the app from https://<login>.github.io/sprawunki/
  base: '/sprawunki/',
  test: {
    include: ['tests/**/*.test.js'],
    // No tests exist yet in step 1; remove once store tests are added
    passWithNoTests: true,
  },
});
