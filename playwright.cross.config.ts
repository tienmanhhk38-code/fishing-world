import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  testMatch: ["game.spec.ts","audio.spec.ts"],
  grep: /two guests share|music streams|unavailable music/,
  timeout: 120000,
  workers: 1,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1100, height: 700 },
  },
  projects: [
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
});
