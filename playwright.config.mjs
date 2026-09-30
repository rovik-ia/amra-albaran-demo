import { defineConfig, devices } from "@playwright/test";

// CHROMIUM_PATH permite usar un Chromium ya instalado en lugar de descargar uno.
const PORT = Number(process.env.PORT || 4173);
const launchOptions = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

export default defineConfig({
  testDir: "tests",
  timeout: 45_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/amra-albaran-demo/`,
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    launchOptions,
  },
  webServer: {
    command: "node tests/server.mjs",
    url: `http://127.0.0.1:${PORT}/amra-albaran-demo/`,
    reuseExistingServer: true,
  },
  projects: [
    { name: "movil-375", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 } },
    { name: "movil-390", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 } },
    { name: "tablet-768", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: "portatil-1024", use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 } } },
    { name: "escritorio-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
});
