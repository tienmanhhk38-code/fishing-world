import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 90000,
  workers: 1,
  expect: { timeout: 10000 },
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1100, height: 700 },
    launchOptions: {
      args: [
        "--enable-webgl",
        ...(process.env.PLAYWRIGHT_HARDWARE === "true" &&
        process.platform === "win32"
          ? [
              "--use-angle=d3d11",
              "--use-gl=angle",
              "--disable-software-rasterizer",
            ]
          : []),
      ],
    },
  },
});
