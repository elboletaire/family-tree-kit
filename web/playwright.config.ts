import { execFileSync } from 'node:child_process';
import { defineConfig, devices } from '@playwright/test';

// Smoke test on the already built web (`make html`): build/web served as locally, with python3 -m http.server; and the
// site (build/public and build/private) served by deploy/server.py, with the password of E2E_PASSWORD, public on 8766
// (e2e/site.spec.ts) and closed on 8767 (e2e/closed.spec.ts).
// E2E_PAGE allows testing another page of the same folder (e.g. a previous version, to compare).
const password = process.env.E2E_PASSWORD ??= 'e2e-password';
// The folder of the originals (`paths.sources` in families.yml), which the server serves with a session
const sources = execFileSync('uv', ['run', '--quiet', '../scripts/config.py', 'paths.sources'], { encoding: 'utf-8' }).trim();

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8765/',
    ...devices['Desktop Chrome'],
    // The map's tiles come from OpenStreetMap: the tests do not depend on them (nor on the network), nor load its servers
    launchOptions: { args: ['--host-resolver-rules=MAP tile.openstreetmap.org ~NOTFOUND'] },
  },
  webServer: [
    {
      command: 'python3 -m http.server 8765 --bind 127.0.0.1',
      cwd: '../build/web',
      url: 'http://127.0.0.1:8765/',
      reuseExistingServer: !process.env.CI,
      stderr: 'ignore',  // http.server warns about every connection the browser cuts
    },
    ...([['8766', '1'], ['8767', '0']] as const).map(([port, open]) => ({
      command: 'python3 ../deploy/server.py',
      url: `http://127.0.0.1:${port}/health`,
      reuseExistingServer: !process.env.CI,
      env: {
        SITE_PASSWORD: password, PORT: port, PUBLIC_SITE: open, PUBLIC_DIR: '../build/public',
        PRIVATE_DIR: '../build/private', SOURCES_ROOT: `../${sources}`, SOURCES_DIR: sources,
      },
    })),
  ],
});
