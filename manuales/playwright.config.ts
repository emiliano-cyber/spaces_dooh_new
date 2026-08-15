import { defineConfig, devices } from '@playwright/test'

// Arnés de capturas del manual de usuario. NO es una suite de pruebas: no
// afirma nada sobre la aplicación, solo la recorre y la fotografía.
//
// Se corre con:
//   npx playwright test --config manuales/playwright.config.ts
//
// Variables de entorno:
//   CAPTURAS_BASE_URL  raíz de la app (por omisión, el local con basePath)
//   CAPTURAS_USER      correo del usuario Dueño
//   CAPTURAS_PASS      su contraseña
//
// Sin CAPTURAS_PASS el arnés NO falla: toma las capturas que no necesitan
// sesión y salta el resto con su motivo. Media captura es peor que ninguna.

const BASE = process.env.CAPTURAS_BASE_URL ?? 'http://localhost:3000/spaces-dooh'

// Nunca contra producción. El manual dice que las capturas salen del entorno de
// pruebas, y una imagen con datos de producción en un PDF que circula por correo
// es una fuga. Este corte es a propósito redundante con el criterio de quien lo
// corre: la máquina no se cansa de comprobarlo.
if (!/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(BASE)) {
  throw new Error(
    `CAPTURAS_BASE_URL apunta fuera de local (${BASE}). Las capturas solo se ` +
      `toman contra el entorno de pruebas local. Abortado.`,
  )
}

export default defineConfig({
  testDir: '.',
  outputDir: './.playwright-artifacts',
  // Un solo worker: el orden de los archivos importa poco, pero el servidor de
  // desarrollo compila bajo demanda y varios workers en paralelo lo ahogan.
  workers: 1,
  fullyParallel: false,
  // Sin reintentos: si una captura no sale, quiero saberlo y anotarla en
  // pendientes, no que se maquille con un segundo intento.
  retries: 0,
  reporter: [['list']],
  // El servidor va en modo desarrollo y compila la primera visita a cada ruta
  // (el login tardó 18 s en frío). Estos plazos son para esa primera visita, no
  // para esperar a ciegas: dentro de cada captura se espera SIEMPRE por
  // condición visible, nunca por reloj.
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: BASE,
    // Viewport fijo para que todas las imágenes se vean parejas en el PDF.
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    // deviceScaleFactor 2: el PDF se imprime y a 1x el texto de la interfaz sale
    // sucio en papel.
    deviceScaleFactor: 2,
    navigationTimeout: 90_000,
    actionTimeout: 20_000,
    ignoreHTTPSErrors: true,
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
  },
  projects: [
    // Inicia sesión una sola vez y guarda la cookie. /api/auth/login está
    // limitado a 10 intentos por 5 minutos y por IP: una sesión por captura
    // agotaría el cupo a mitad del recorrido y las últimas saldrían en la
    // pantalla de acceso sin que nadie lo notara.
    { name: 'sesion', testMatch: /sesion\.setup\.ts/ },
    {
      name: 'publicas',
      testMatch: /capturas\.spec\.ts/,
      grep: /@publica/,
    },
    {
      name: 'privadas',
      testMatch: /capturas\.spec\.ts/,
      grep: /@privada/,
      dependencies: ['sesion'],
      use: { storageState: './manuales/.auth/estado.json' },
    },
  ],
})
