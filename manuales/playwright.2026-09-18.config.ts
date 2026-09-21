import { defineConfig, devices } from '@playwright/test'

// Arnés de capturas del manual de septiembre (razones sociales, consumo de
// luz, reportes de rentabilidad). Hermano de `playwright.config.ts` (el del
// manual de agosto): mismo criterio, config aparte porque este recorrido usa
// TRES sesiones (Dueño, Operaciones) y una base que se muta a propósito a
// mitad de la corrida (ver capturas-2026-09-18.spec.ts, prueba 8).
//
// Correr:
//   npx playwright test --config manuales/playwright.2026-09-18.config.ts

const BASE = process.env.CAPTURAS_BASE_URL ?? 'http://localhost:3000/spaces-dooh'

if (!/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(BASE)) {
  throw new Error(
    `CAPTURAS_BASE_URL apunta fuera de local (${BASE}). Las capturas solo se ` +
      `toman contra el entorno de pruebas local. Abortado.`,
  )
}

export default defineConfig({
  testDir: '.',
  testMatch: /capturas-2026-09-18\.spec\.ts/,
  outputDir: './.playwright-artifacts-2026-09-18',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: BASE,
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    navigationTimeout: 90_000,
    actionTimeout: 20_000,
    ignoreHTTPSErrors: true,
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
  },
})
