import { defineConfig, devices } from '@playwright/test';

// Local smoke test against the production build, served under the Pages base path.
// Not run in CI (spec 8.3).
export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4173/landscape-of-loss/',
    viewport: { width: 1280, height: 800 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } }],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/landscape-of-loss/',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
