import { defineConfig, devices } from '@playwright/test';

// The screenshots of the READMEs (docs/screenshots), on the demo (`make demo`, build/demo) served as locally, with
// python3 -m http.server. `make screenshots` builds the demo and runs this.
export default defineConfig({
  testDir: 'screenshots',
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8768/',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
  },
  webServer: {
    command: 'python3 -m http.server 8768 --bind 127.0.0.1',
    cwd: '../build/demo',
    url: 'http://127.0.0.1:8768/',
    reuseExistingServer: !process.env.CI,
    stderr: 'ignore',
  },
});
