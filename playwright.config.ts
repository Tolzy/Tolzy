import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;
const HEAVY = /materials\.spec\.ts/;
const DESKTOP = { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } };
const MOBILE = { ...devices["Pixel 7"] };

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  // The 3D viewer renders with software WebGL in CI: frames can take 100 ms+.
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // Software WebGL so the 3D viewer renders on CI machines without a GPU.
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  // Material and lighting tests render physical materials (Glass, at a few
  // fps in software WebGL). They run after the other projects so they do not
  // starve the timing-sensitive interaction tests of CPU.
  projects: [
    { name: "desktop", testIgnore: HEAVY, use: DESKTOP },
    { name: "mobile", testIgnore: HEAVY, use: MOBILE },
    { name: "desktop-rendering", testMatch: HEAVY, use: DESKTOP, dependencies: ["desktop", "mobile"] },
    { name: "mobile-rendering", testMatch: HEAVY, use: MOBILE, dependencies: ["desktop", "mobile"] },
  ],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/dashboard`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
