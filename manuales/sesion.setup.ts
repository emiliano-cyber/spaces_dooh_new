import { test as setup, expect } from '@playwright/test'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'

const ESTADO = 'manuales/.auth/estado.json'

// Ruta absoluta a mano, no `baseURL`: '/login/' empieza por barra, así que se
// resuelve como ABSOLUTA y se come el basePath /spaces-dooh.
const BASE = (process.env.CAPTURAS_BASE_URL ?? 'http://localhost:3000/spaces-dooh').replace(/\/$/, '')

// El archivo guarda una cookie de sesión viva. No debe entrar a git: va en el
// .gitignore junto a manuales/capturas/.
const USER = process.env.CAPTURAS_USER
const PASS = process.env.CAPTURAS_PASS

setup('inicia sesión una vez y guarda el estado', async ({ page }) => {
  // Sin contraseña se deja un estado vacío para que el proyecto dependiente
  // pueda arrancar y saltar sus capturas con un motivo claro, en vez de
  // reventar con «no such file».
  if (!USER || !PASS) {
    mkdirSync(dirname(ESTADO), { recursive: true })
    if (!existsSync(ESTADO)) {
      writeFileSync(ESTADO, JSON.stringify({ cookies: [], origins: [] }))
    }
    setup.skip(true, 'Faltan CAPTURAS_USER y CAPTURAS_PASS: no hay sesión que guardar.')
    return
  }

  await page.goto(`${BASE}/login/`)

  // Por condición, no por reloj: en desarrollo la primera visita compila.
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()

  await page.getByLabel('Correo').fill(USER)
  await page.getByLabel('Contraseña').fill(PASS)
  await page.getByRole('button', { name: 'Entrar' }).click()

  // La confirmación de que entró es el menú lateral, que es justo lo que el
  // manual promete ver («aparece el menú lateral con los grupos…»). Esperar la
  // URL no bastaría: /login redirige antes de que el shell haya pintado.
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Dashboard' })).toBeVisible()

  mkdirSync(dirname(ESTADO), { recursive: true })
  await page.context().storageState({ path: ESTADO })
})
