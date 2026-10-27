import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// GitHub Pages serves the site from /<repository>/ (spec 8.3).
export default defineConfig({
  base: '/landscape-of-loss/',
  plugins: [svelte()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
