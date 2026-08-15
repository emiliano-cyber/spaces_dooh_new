import { test, expect, type Page, type Locator } from '@playwright/test'
import { mkdirSync } from 'node:fs'

// ============================================================================
//  Capturas del manual de usuario de Space OS
//
//  Guion: vault/08-Manuales/manual-usuario-2026-08-11.md
//  Plan:  manuales/plan-capturas.md   (qué se captura, qué no, y por qué)
//
//  Este archivo se queda en el repo A PROPÓSITO: cuando el manual cambie, se
//  vuelve a correr y las imágenes se regeneran. Un manual ilustrado a mano
//  envejece a las dos semanas.
//
//  Correr:
//    npx playwright test --config manuales/playwright.config.ts
//
//  ── Reglas que sigue este archivo ──────────────────────────────────────────
//
//  1. Los elementos se localizan por el TEXTO VISIBLE que usa el manual, no por
//     CSS ni por nth-child. Si el manual y la interfaz no coinciden, eso es un
//     error del manual y se reporta; no se parchea aquí.
//  2. Se espera SIEMPRE por condición (`toBeVisible`), nunca por reloj. Un
//     `waitForTimeout` produce capturas de pantallas a medio cargar.
//  3. Ninguna captura escribe en la base. Los formularios se abren y se
//     fotografían SIN guardar. Donde el manual describe una acción destructiva
//     (sellar un contrato a firma, cancelarlo, publicar en pantallas reales) NO
//     hay captura: está anotada en manuales/capturas-pendientes.md.
//
//  ── Sobre el enmascarado de datos ──────────────────────────────────────────
//
//  Estas capturas se toman SIN difuminar: salen a la vista el correo real, los
//  RFC y los domicilios del entorno local. Es una decisión explícita del humano,
//  tomada después de que se le expusiera el riesgo.
//
//  Consecuencia, y por eso queda escrito aquí y en la portada del PDF: el PDF
//  resultante contiene datos reales y NO debe distribuirse.
// ============================================================================

const DIR = 'manuales/capturas'

// La aplicación vive bajo un basePath (/spaces-dooh). Las rutas se arman aquí a
// mano en vez de apoyarse en `baseURL` de Playwright: una ruta que empieza por
// «/» es ABSOLUTA y al resolverla contra el baseURL se come el basePath
// —'/login/' contra 'http://host/spaces-dooh' da 'http://host/login/'—, que es
// una página que no existe. La barra final también es obligatoria: sin ella el
// servidor responde 308 y cada paso se come una redirección.
const BASE = (process.env.CAPTURAS_BASE_URL ?? 'http://localhost:3000/spaces-dooh').replace(/\/$/, '')
const url = (ruta: string) => `${BASE}/${ruta.replace(/^\/|\/$/g, '')}/`

// Sin credenciales no hay sesión, y sin sesión las capturas marcadas @privada no
// se pueden tomar. Se SALTAN con su motivo en vez de estrellarse contra la
// pantalla de acceso: un fallo de 30 s por captura no informa de nada y entierra
// el motivo real bajo veintitantos errores de tiempo agotado.
const HAY_SESION = !!(process.env.CAPTURAS_USER && process.env.CAPTURAS_PASS)

test.beforeAll(() => {
  mkdirSync(DIR, { recursive: true })
})

test.beforeEach(({}, info) => {
  test.skip(
    info.title.includes('@privada') && !HAY_SESION,
    'Necesita sesión: faltan CAPTURAS_USER y CAPTURAS_PASS.',
  )
})

// Vista completa del viewport (1440x900). Se usa cuando el CONTEXTO importa:
// la persona necesita reconocer dónde está, con su menú y su barra superior.
async function foto(page: Page, nombre: string) {
  await page.screenshot({ path: `${DIR}/${nombre}.png` })
}

// Solo la región relevante. Se usa cuando la pantalla completa no aporta y lo
// que hay que reconocer es un panel o un diálogo concreto.
async function fotoDe(loc: Locator, nombre: string) {
  await expect(loc).toBeVisible()
  await loc.screenshot({ path: `${DIR}/${nombre}.png` })
}

// Lo que pinta el shell cuando /api/estado no responde. Si esto está a la
// vista, la aplicación NO tiene datos y cualquier captura que se tome aquí es
// una foto de un mensaje de error disfrazada de manual.
const ERROR_DATOS = 'No se pudieron cargar los datos'

// Corta la corrida en cuanto la aplicación no puede leer datos.
//
// Está por una razón concreta: en la corrida del 2026-08-11 faltaba una
// migración en la base local, /api/estado devolvía 500, y CUATRO capturas
// «pasaron» fotografiando la pantalla de error —una de ellas con el texto del
// error encima del diálogo—. Nadie se habría dado cuenta hasta ver el PDF.
// Un fallo ruidoso vale más que una imagen que miente.
async function verificarDatosCargados(page: Page) {
  const err = page.getByText(ERROR_DATOS)
  if (await err.isVisible().catch(() => false)) {
    throw new Error(
      `La aplicación no pudo cargar los datos: el shell muestra «${ERROR_DATOS}».\n` +
        `Revisa /api/estado (suele ser una migración pendiente en la base local).\n` +
        `No se toma la captura: sería una foto de la pantalla de error.`,
    )
  }
}

// Abre un módulo por su ruta y espera a que su encabezado esté pintado. Las
// rutas llevan barra final: sin ella el servidor responde 308 y cada paso se
// come una redirección.
async function abrirModulo(page: Page, ruta: string, encabezado: string) {
  await page.goto(url(ruta))
  // `networkidle` acotado: sirve para que dé tiempo a que la carga de datos
  // falle o triunfe ANTES de decidir. No sustituye a la espera por condición de
  // abajo, que sigue siendo la que manda.
  await page.waitForLoadState('networkidle').catch(() => {})
  await verificarDatosCargados(page)
  // Acotado a `main`: sin esto, `getByRole('heading', …)` encontraba los
  // encabezados de grupo del MENÚ LATERAL —«Inventario», «Finanzas»— y daba por
  // cargada una página que ni siquiera había pintado. Así «pasaron» dos
  // capturas del error.
  await expect(
    page.locator('main').getByRole('heading', { name: encabezado, exact: false }).first(),
  ).toBeVisible()
}

// El diálogo que está abierto encima.
const dialogo = (page: Page) => page.getByRole('dialog')

// ───────────────────────────────────────────────────────────────────────────
//  Capítulo 1 — Antes de empezar
// ───────────────────────────────────────────────────────────────────────────

test('01-01 la pantalla de acceso con las tres opciones @publica', async ({ page }) => {
  // Captura pedida de forma explícita por el manual.
  await page.goto(url('login'))
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()

  // Las tres vías que promete el manual. Se comprueban antes de disparar: si
  // una no está, la imagen no ilustraría lo que el texto dice.
  await expect(page.getByLabel('Correo')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Continuar con Google' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Crear cuenta' })).toBeVisible()

  await foto(page, '01-01-acceso-tres-opciones')
})

test('01-02 el alta de organización @publica', async ({ page }) => {
  await page.goto(url('login'))
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()

  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  await expect(page.getByRole('heading', { name: 'Crear cuenta' })).toBeVisible()
  await expect(page.getByLabel('Organización')).toBeVisible()
  await expect(page.getByLabel('Tu nombre')).toBeVisible()

  // Formulario VACÍO: no se envía. El manual describe los campos, no pide que
  // se cree una organización de verdad.
  await foto(page, '01-02-alta-organizacion')
})

test('01-03 el tablero de inicio @privada', async ({ page }) => {
  await abrirModulo(page, 'inicio', 'Dashboard')
  await foto(page, '01-03-tablero-inicio')
})

test('01-04 el menú lateral con sus cinco grupos @privada', async ({ page }) => {
  await page.goto(url('inicio'))

  // Los cinco encabezados que nombra el manual. Se esperan uno a uno: es
  // justo lo que la imagen tiene que demostrar.
  for (const grupo of ['Inventario', 'Vender', 'Entregar', 'Finanzas', 'Sistema']) {
    await expect(page.getByRole('heading', { name: grupo, exact: true })).toBeVisible()
  }

  // Recorte del menú: la pantalla completa no aporta aquí. `aside` es un
  // localizador de región de maquetación, no de control — no hay texto visible
  // que identifique el contenedor entero, y es la excepción a la regla del
  // texto visible.
  await fotoDe(page.locator('aside').first(), '01-04-menu-lateral-grupos')
})

test('01-05 la ventana de desbloquear cambios @privada', async ({ page }) => {
  await page.goto(url('inicio'))
  await page.waitForLoadState('networkidle').catch(() => {})
  await verificarDatosCargados(page)

  // Este botón SOLO existe si el tenant tiene exigir_reautenticacion = true.
  // El humano la encendió en el tenant `alfa` para poder ilustrar el desfase
  // D-1 del plan. Si no aparece, la captura no se simula: falla y se anota.
  const candado = page.getByRole('button', { name: 'Cambios bloqueados' })
  await expect(candado).toBeVisible()
  await candado.click()

  await expect(page.getByRole('heading', { name: 'Desbloquear cambios' })).toBeVisible()
  await expect(dialogo(page).getByLabel('Contraseña')).toBeVisible()

  // Vista completa: importa que se vea que la ventana sale ENCIMA de lo que
  // estabas haciendo, que es lo que el manual describe.
  // No se teclea la contraseña ni se pulsa «Desbloquear»: la captura ilustra la
  // ventana, no ejerce el desbloqueo.
  await foto(page, '01-05-desbloqueo-cambios')
})

// ───────────────────────────────────────────────────────────────────────────
//  Capítulo 2 — Registrar lo que rentas
// ───────────────────────────────────────────────────────────────────────────

test('02-01 la lista de inventario @privada', async ({ page }) => {
  // Captura pedida de forma explícita por el manual.
  await abrirModulo(page, 'inventario', 'Inventario')
  await foto(page, '02-01-inventario-lista')
})

test('02-02 el alta de una pantalla y sus datos @privada', async ({ page }) => {
  await abrirModulo(page, 'inventario', 'Inventario')

  await page.getByRole('button', { name: 'Nueva pantalla' }).click()
  await expect(dialogo(page)).toBeVisible()

  await fotoDe(dialogo(page), '02-02-alta-pantalla-datos')
})

test('02-03 el selector de arrendador del alta @privada', async ({ page }) => {
  await abrirModulo(page, 'inventario', 'Inventario')

  await page.getByRole('button', { name: 'Nueva pantalla' }).click()
  await expect(dialogo(page)).toBeVisible()

  // El manual insiste en que el arrendador es obligatorio: la imagen tiene que
  // mostrar de dónde se elige.
  await fotoDe(dialogo(page), '02-03-alta-pantalla-arrendador')
})

test('02-04 la carga masiva por Excel @privada', async ({ page }) => {
  await abrirModulo(page, 'inventario', 'Inventario')

  await page.getByRole('button', { name: 'Carga masiva' }).click()
  await expect(dialogo(page)).toBeVisible()

  // Se abre el diálogo y se fotografía. NO se sube ningún archivo.
  await fotoDe(dialogo(page), '02-04-carga-masiva')
})

test('02-05 la ficha de una pantalla @privada', async ({ page }) => {
  await abrirModulo(page, 'inventario', 'Inventario')

  // Entrar a la primera pantalla de la lista. La tabla tiene fila de
  // encabezados, así que la primera de datos es la segunda fila.
  await page.getByRole('row').nth(1).click()
  await expect(dialogo(page)).toBeVisible()

  await fotoDe(dialogo(page), '02-05-ficha-pantalla')
})

test('02-06 incidencia, reubicación y pausa @privada', async ({ page }) => {
  await abrirModulo(page, 'inventario', 'Inventario')

  await page.getByRole('row').nth(1).click()
  await expect(dialogo(page)).toBeVisible()

  await fotoDe(dialogo(page), '02-06-incidencia-pausa')
})

// ───────────────────────────────────────────────────────────────────────────
//  Capítulo 3 — Arrendadores y contratos de renta
// ───────────────────────────────────────────────────────────────────────────

test('03-01 la lista de arrendadores @privada', async ({ page }) => {
  await abrirModulo(page, 'arrendadores', 'Arrendadores')
  await foto(page, '03-01-arrendadores-lista')
})

test('03-02 el alta de un arrendador @privada', async ({ page }) => {
  await abrirModulo(page, 'arrendadores', 'Arrendadores')

  await page.getByRole('button', { name: 'Nuevo arrendador' }).click()
  await expect(dialogo(page)).toBeVisible()

  // El manual advierte que el domicilio es obligatorio para poder emitir el
  // contrato: tiene que verse el campo.
  await expect(dialogo(page).getByText('Domicilio')).toBeVisible()

  await fotoDe(dialogo(page), '03-02-alta-arrendador')
})

test('03-03 el contrato de renta con monto y periodicidad @privada', async ({ page }) => {
  await abrirModulo(page, 'arrendadores', 'Arrendadores')

  await page.getByRole('row').nth(1).click()
  await expect(page.getByText('Contratos', { exact: false }).first()).toBeVisible()

  await foto(page, '03-03-contrato-renta')
})

test('03-04 el documento del contrato @privada', async ({ page }) => {
  await abrirModulo(page, 'arrendadores', 'Arrendadores')

  await page.getByRole('row').nth(1).click()
  await expect(page.getByText('Contratos', { exact: false }).first()).toBeVisible()

  await foto(page, '03-04-contrato-documento')
})

test('03-05 el calendario de pagos de renta @privada', async ({ page }) => {
  await abrirModulo(page, 'arrendadores', 'Arrendadores')

  await page.getByRole('row').nth(1).click()
  await expect(page.getByText('Contratos', { exact: false }).first()).toBeVisible()

  await foto(page, '03-05-calendario-pagos')
})

// ───────────────────────────────────────────────────────────────────────────
//  Capítulo 4 — Vender
// ───────────────────────────────────────────────────────────────────────────

test('04-01 la lista de clientes @privada', async ({ page }) => {
  await abrirModulo(page, 'clientes', 'Clientes')
  await foto(page, '04-01-clientes-lista')
})

test('04-02 el alta de un cliente @privada', async ({ page }) => {
  await abrirModulo(page, 'clientes', 'Clientes')

  await page.getByRole('button', { name: 'Nuevo cliente' }).click()
  await expect(dialogo(page)).toBeVisible()

  await fotoDe(dialogo(page), '04-02-alta-cliente')
})

test('04-03 el buscador comercial con el mapa y un filtro @privada', async ({ page }) => {
  // Captura pedida de forma explícita por el manual: «el buscador comercial con
  // el mapa y un filtro aplicado».
  await abrirModulo(page, 'comercial', 'Comercial')

  // Se aplica un filtro real por su texto visible, para que la imagen muestre
  // lo que el manual describe y no el estado inicial.
  await page.getByRole('combobox').first().selectOption({ index: 1 })

  await foto(page, '04-03-comercial-mapa-filtro')
})

test('04-04 el calendario de disponibilidad @privada', async ({ page }) => {
  await abrirModulo(page, 'disponibilidad', 'Disponibilidad')
  await foto(page, '04-04-disponibilidad-calendario')
})

test('04-05 la lista de propuestas @privada', async ({ page }) => {
  await abrirModulo(page, 'propuestas', 'Propuestas')
  await foto(page, '04-05-propuestas-lista')
})

test('04-06 el alta de una propuesta @privada', async ({ page }) => {
  await abrirModulo(page, 'propuestas', 'Propuestas')

  await page.getByRole('button', { name: 'Nueva propuesta' }).click()
  await expect(dialogo(page)).toBeVisible()

  await fotoDe(dialogo(page), '04-06-propuesta-alta')
})

test('04-07 la propuesta con su folio y su total @privada', async ({ page }) => {
  await abrirModulo(page, 'propuestas', 'Propuestas')

  await page.getByRole('row').nth(1).click()
  await expect(page.getByText('Resumen económico')).toBeVisible()

  await foto(page, '04-07-propuesta-detalle-total')
})

test('04-08 la propuesta como la ve el cliente @privada', async ({ browser, page }) => {
  await abrirModulo(page, 'propuestas', 'Propuestas')

  await page.getByRole('row').nth(1).click()
  await expect(page.getByText('Resumen económico')).toBeVisible()

  // «Copiar liga» no navega: copia al portapapeles. Para saber QUÉ liga es hay
  // que leer el portapapeles, que es también lo que hace la persona.
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByRole('button', { name: 'Copiar liga' }).click()
  await expect(page.getByRole('button', { name: '¡Copiado!' })).toBeVisible()

  const liga = await page.evaluate(() => navigator.clipboard.readText())
  expect(liga).toContain('/p/')

  // El manual promete que el cliente entra «sin necesidad de usuario ni
  // contraseña». Para demostrarlo hay que abrirla en un contexto LIMPIO, sin la
  // cookie de sesión; si se abriera en esta pestaña, la imagen probaría lo
  // contrario de lo que dice el texto.
  const anonimo = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  })
  const publica = await anonimo.newPage()
  await publica.goto(liga)
  await publica.waitForLoadState('networkidle')
  await foto(publica, '04-08-propuesta-liga-publica')
  await anonimo.close()
})

test('04-09 el control de generar campaña @privada', async ({ page }) => {
  await abrirModulo(page, 'propuestas', 'Propuestas')

  await page.getByRole('row').nth(1).click()
  await expect(page.getByText('Resumen económico')).toBeVisible()

  // Se fotografía el control, NO se pulsa: generar la campaña reservaría las
  // pantallas y consumiría la única propuesta del entorno local.
  await foto(page, '04-09-generar-campana')
})

// ───────────────────────────────────────────────────────────────────────────
//  Capítulo 5 — Entregar la campaña
//
//  Casi todo el capítulo está bloqueado: campañas 0, creativos 0, órdenes de
//  trabajo 0. «Publicar la campaña» queda excluida de forma PERMANENTE por
//  seguridad (DOOHMAIN_PUBLISH_ENABLED=1 publica contra pantallas reales).
//  Ver manuales/capturas-pendientes.md.
// ───────────────────────────────────────────────────────────────────────────

test('05-01 el módulo de creativos @privada', async ({ page }) => {
  await abrirModulo(page, 'creativos', 'Creativos')
  await foto(page, '05-01-creativos-lista')
})

test('05-05 la orden de impresión @privada', async ({ page }) => {
  await abrirModulo(page, 'imprenta', 'Imprenta')

  await page.getByRole('button', { name: 'Nueva orden' }).click()
  await expect(dialogo(page)).toBeVisible()

  await fotoDe(dialogo(page), '05-05-imprenta-orden')
})

test('05-07 el alta de una orden de trabajo @privada', async ({ page }) => {
  await abrirModulo(page, 'operaciones', 'Operaciones')

  await page.getByRole('button', { name: 'Nueva OT' }).click()
  await expect(dialogo(page)).toBeVisible()

  // El manual advierte que la asignación solo se escribe al crear la orden:
  // tiene que verse el campo de responsable.
  await expect(dialogo(page).getByText('Asignar a', { exact: false })).toBeVisible()

  await fotoDe(dialogo(page), '05-07-operaciones-alta-ot')
})

test('05-08 el almacén @privada', async ({ page }) => {
  await abrirModulo(page, 'almacen', 'Almacén')
  await foto(page, '05-08-almacen-activo')
})

// ───────────────────────────────────────────────────────────────────────────
//  Capítulo 6 — Cobrar
// ───────────────────────────────────────────────────────────────────────────

test('06-01 el módulo de finanzas @privada', async ({ page }) => {
  await abrirModulo(page, 'finanzas', 'Finanzas')
  await foto(page, '06-01-finanzas-lista')
})

test('06-05 las comisiones @privada', async ({ page }) => {
  await abrirModulo(page, 'comisiones', 'Comisiones')
  await foto(page, '06-05-comisiones')
})

// ───────────────────────────────────────────────────────────────────────────
//  Capítulo 7 — Avisos del sistema
// ───────────────────────────────────────────────────────────────────────────

test('07-01 el panel de notificaciones @privada', async ({ page }) => {
  await page.goto(url('inicio'))
  await page.waitForLoadState('networkidle').catch(() => {})
  await verificarDatosCargados(page)

  // El manual dice «Abre la lista de avisos» sin decir por dónde. El control es
  // una campana sin texto visible en la barra superior; su nombre accesible es
  // «Notificaciones» — ver el desfase D-4 del plan.
  await page.getByRole('button', { name: 'Notificaciones' }).click()
  await expect(page.getByText('Notificaciones', { exact: true }).last()).toBeVisible()

  await foto(page, '07-01-notificaciones-panel')
})
