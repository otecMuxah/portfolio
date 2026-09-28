import { defineConfig, devices } from '@playwright/test';

// Parallel worktrees each set their own E2E_PORT so they never share a dev server.
const port = Number(process.env['E2E_PORT'] ?? 4300);

export default defineConfig({
  testDir: 'e2e',
  // scrollToChapter renders ~400 frames in software WebGL; under a parallel run that can pass 30 s.
  timeout: 60_000,
  use: { baseURL: `http://localhost:${port}`, ...devices['Desktop Chrome'] },
  webServer: {
    command: `npx ng serve --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
