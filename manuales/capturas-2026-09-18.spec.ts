import { test, expect, request as pwRequest, type Browser, type Page, type Locator } from '@playwright/test'
import { mkdirSync, existsSync } from 'node:fs'

// ============================================================================
//  Capturas del manual de usuario de septiembre — los DIEZ apartados.
//
//  Guion: vault/08-Manuales/manual-usuario-2026-09-18.md
//  Plan:  manuales/plan-capturas.md  (qué se captura, qué no, y por qué)
//  Lo que no se pudo tomar: manuales/capturas-pendientes.md
//
//  Se queda en el repo a propósito: cuando el manual cambie, se vuelve a correr
//  contra una base de demostración y las imágenes se regeneran.
//
//  ─── Qué necesita ─────────────────────────────────────────────────────────
//   · La app en `next build && next start` (NUNCA `next dev`: la CSP bloquea
//     el `eval` del Fast Refresh y el botón «Entrar» se queda muerto).
//   · Una base PROPIA, sembrada con
//       node scripts/semilla-demo.mjs --org=demo-rentabilidad
//     y una segunda organización SIN razones sociales para el cuestionario de
//     bienvenida (la de la corrida del 24/09 se llamó `demo-bienvenida`).
//   · Cuatro cuentas: Dueño y Operaciones de demo-rentabilidad, un Dueño de
//     demo-rentabilidad marcado `solo_google` (para el aviso del 1.3) y un
//     Dueño de la organización vacía.
//   · `FLOTA_TOKEN` puesto en el servidor Y en el entorno de esta corrida: la
//     respuesta del ticket (7.2) entra por la misma puerta que usa el panel
//     de flota del PADRE, `PATCH /api/tickets` con `x-flota-token`, contra el
//     servidor LOCAL. Sin él, esa captura se salta con su motivo.
//
//  Correr (bash):
//    CAPTURAS_BASE_URL=http://localhost:3470/spaces-dooh \
//    CAPTURAS_USER=… CAPTURAS_PASS=… \
//    CAPTURAS_USER_OPERACIONES=… CAPTURAS_PASS_OPERACIONES=… \
//    CAPTURAS_USER_GOOGLE=… CAPTURAS_PASS_GOOGLE=… \
//    CAPTURAS_USER_BIENVENIDA=… CAPTURAS_PASS_BIENVENIDA=… \
//    FLOTA_TOKEN=… \
//    npx playwright test --config manuales/playwright.2026-09-18.config.ts
//
//  ─── Reglas ───────────────────────────────────────────────────────────────
//   1. Los elementos se localizan por el TEXTO VISIBLE del manual. Un texto que
//      no coincide es un error del manual: se registra con `HALLAZGO:` en la
//      salida, no se parchea aquí.
//   2. Se espera SIEMPRE por condición, nunca por reloj.
//   3. Antes de cada foto se difumina lo que parezca un dato real: correos que
//      no acaban en `.invalid` y RFC que no empiezan por `DMO`. Con la semilla
//      no debería aparecer ninguno; la función cuenta cuántos tapó y lo dice.
//      Los códigos de recuperación se difuminan SIEMPRE: son un secreto.
//   4. Este guion ESCRIBE en la base (baja y alta de una razón social, un
//      contrato asignado, un ticket, recibos de luz). Por eso exige una base
//      propia: nunca la `spaces` compartida del 5433.
//   5. Nombres: `NN-MM-PP-descripcion.png` — apartado, subapartado (`00` si no
//      tiene) y paso. El orden alfabético es el del manual.
// ============================================================================

const DIR = 'vault/08-Manuales/capturas-2026-09-18'
const AUTH = 'manuales/.auth/2026-09-18'

const BASE = (process.env.CAPTURAS_BASE_URL ?? 'http://localhost:3000/spaces-dooh').replace(/\/$/, '')
const url = (ruta: string) => `${BASE}/${ruta.replace(/^\/|\/$/g, '')}/`

type Cuenta = 'dueno' | 'operaciones' | 'google' | 'bienvenida'
const CUENTAS: Record<Cuenta, { user?: string; pass?: string }> = {
  dueno: { user: process.env.CAPTURAS_USER, pass: process.env.CAPTURAS_PASS },
  operaciones: { user: process.env.CAPTURAS_USER_OPERACIONES, pass: process.env.CAPTURAS_PASS_OPERACIONES },
  google: { user: process.env.CAPTURAS_USER_GOOGLE, pass: process.env.CAPTURAS_PASS_GOOGLE },
  bienvenida: { user: process.env.CAPTURAS_USER_BIENVENIDA, pass: process.env.CAPTURAS_PASS_BIENVENIDA },
}
const FLOTA_TOKEN = process.env.FLOTA_TOKEN

// El mismo contexto para todas las fotos: el viewport fijo es lo que hace que
// las imágenes se vean parejas en el PDF.
const CONTEXTO = {
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  locale: 'es-MX',
  timezoneId: 'America/Mexico_City',
}

test.beforeAll(() => {
  mkdirSync(DIR, { recursive: true })
  // Las sesiones se guardan UNA vez por corrida: el acceso admite 10 intentos
  // por IP cada 5 minutos, y entrar en cada prueba los agotaría a la mitad.
  // NO se borran aquí: si una prueba falla, Playwright reinicia el worker y
  // repite este beforeAll, y borrar aquí volvería a gastar intentos. Se borra
  // la carpeta a mano (o el lanzador) al empezar una corrida nueva.
  mkdirSync(AUTH, { recursive: true })
})

/**
 * Un contexto con la sesión de `cuenta`, iniciándola solo la primera vez.
 *
 * `aparte` da una sesión PROPIA, que no comparte cookie con las demás. Hace
 * falta donde se fotografía el candado de contraseña: desbloquear vale para la
 * sesión entera durante un rato, y el 1.2 ya desbloquea la del Dueño.
 */
async function abrir(browser: Browser, cuenta: Cuenta, aparte?: string): Promise<Page> {
  const { user, pass } = CUENTAS[cuenta]
  if (!user || !pass) throw new Error(`Faltan las credenciales de la cuenta «${cuenta}».`)
  const estado = `${AUTH}/${cuenta}${aparte ? '-' + aparte : ''}.json`
  if (!existsSync(estado)) {
    const ctx = await browser.newContext(CONTEXTO)
    const p = await ctx.newPage()
    await p.goto(url('login'))
    await expect(p.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
    await p.getByLabel('Correo').fill(user)
    await p.getByLabel('Contraseña').fill(pass)
    await p.getByRole('button', { name: 'Entrar' }).click()
    await p.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30_000 })
    await ctx.storageState({ path: estado })
    await ctx.close()
  }
  const ctx = await browser.newContext({ ...CONTEXTO, storageState: estado })
  return ctx.newPage()
}

/** Difumina lo que parezca un dato real. Devuelve cuántos elementos tapó. */
async function enmascarar(page: Page): Promise<number> {
  return page.evaluate(() => {
    const correo = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g
    const rfc = /\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/g
    const marcar = new Set<HTMLElement>()
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (w.nextNode()) {
      const t = w.currentNode.textContent ?? ''
      const real =
        (t.match(correo) ?? []).some((c) => !c.toLowerCase().endsWith('.invalid')) ||
        (t.match(rfc) ?? []).some((r) => !r.startsWith('DMO'))
      if (real && w.currentNode.parentElement) marcar.add(w.currentNode.parentElement)
    }
    document.querySelectorAll('input').forEach((i) => {
      const v = (i as HTMLInputElement).value
      if ((v.match(correo) ?? []).some((c) => !c.toLowerCase().endsWith('.invalid'))) marcar.add(i as HTMLElement)
    })
    marcar.forEach((el) => (el.style.filter = 'blur(6px)'))
    return marcar.size
  })
}

/**
 * La interfaz QUIETA antes de disparar, por condición y nunca por reloj:
 *  · la red sin peticiones en vuelo (la primera corrida sacó tablas a medio
 *    llenar y un tablero con su spinner);
 *  · todas las animaciones FINITAS terminadas (paneles que entran deslizándose,
 *    cuadros que aparecen, avisos flotantes). Las infinitas —un spinner— se
 *    dejan fuera, o esto no terminaría nunca;
 *  · sin foco en ningún campo, para que el anillo de foco no se lea como parte
 *    de la pantalla.
 */
async function quieta(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(async () => {
    const finitas = document
      .getAnimations()
      .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
    await Promise.all(finitas.map((a) => a.finished.catch(() => null)))
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    await document.fonts.ready
  })
}

/** Espera a que se vayan los avisos flotantes, para que no se amontonen en la siguiente foto. */
async function sinAvisos(page: Page) {
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 })
}

async function foto(page: Page, nombre: string, opciones: { region?: Locator; completa?: boolean } = {}) {
  await quieta(page)
  const tapados = await enmascarar(page)
  if (tapados) console.log(`MASCARA ${nombre}: ${tapados} elemento(s) difuminado(s)`)
  const path = `${DIR}/${nombre}.png`
  if (opciones.region) await opciones.region.screenshot({ path })
  else await page.screenshot({ path, fullPage: !!opciones.completa })
}

/** Un hallazgo: el manual y la pantalla no dicen lo mismo. Se reporta, no se parchea. */
function hallazgo(texto: string) {
  console.log(`HALLAZGO: ${texto}`)
}

// ─── 1 · Códigos de recuperación ─────────────────────────────────────────────

test.describe('manual 2026-09-18', () => {
  test('1.2 · generar otros códigos', async ({ browser }) => {
    const page = await abrir(browser, 'dueno')
    // Los códigos son un secreto: se difuminan SIEMPRE, sean de quien sean.
    const taparCodigos = () => page.addStyleTag({ content: 'main ul li { filter: blur(7px) !important; }' })

    // Precondición del 1.2 («a la que vuelves cuando quieras»): que ya exista un
    // lote. Pedir el PRIMERO no lleva contraseña, así que se pide aquí sin foto.
    await page.goto(url('codigos-recuperacion'))
    await expect(page.getByRole('heading', { name: 'Códigos de recuperación' })).toBeVisible()
    // Y que se haya CONFIRMADO («Ya los guardé» + «Continuar», pasos 4-5 del
    // 1.1): el servidor decide si pedir la contraseña por `codigosVistosEn`, no
    // por si existe un lote (`app/api/perfil/codigos-recuperacion/route.ts`).
    // Sin confirmar, el segundo lote tampoco la pide.
    await page.getByRole('button', { name: 'Generar códigos nuevos' }).click()
    const primera = page.getByRole('button', { name: 'Copiar' })
    const pidio = page.getByText('Teclea tu contraseña para confirmar')
    await expect(primera.or(pidio)).toBeVisible()
    if (await pidio.isVisible()) {
      // Ya había un lote confirmado de una corrida anterior.
      await page.getByRole('button', { name: 'Cancelar' }).click()
    } else {
      await page.getByLabel('Ya los guardé en un lugar seguro').check()
      await page.getByRole('button', { name: 'Continuar' }).click()
      await page.waitForURL((u) => u.pathname.includes('/inicio'))
    }

    await page.goto(url('codigos-recuperacion'))
    await expect(page.getByRole('heading', { name: 'Códigos de recuperación' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Generar códigos nuevos' })).toBeVisible()
    await foto(page, '01-02-01-codigos-generar-nuevos')

    await page.getByRole('button', { name: 'Generar códigos nuevos' }).click()
    await expect(page.getByText('Teclea tu contraseña para confirmar')).toBeVisible()
    await page.getByPlaceholder('Tu contraseña').fill(CUENTAS.dueno.pass!)
    await foto(page, '01-02-02-codigos-pide-contrasena')

    await page.getByRole('button', { name: 'Confirmar y generar' }).click()
    await expect(page.getByRole('button', { name: 'Copiar' })).toBeVisible()
    await expect(page.getByText('Ya los guardé en un lugar seguro')).toBeVisible()
    console.log(`MEDIDO-CODIGOS-POR-LOTE: ${await page.locator('main ul li').count()}`)
    await taparCodigos()
    await foto(page, '01-02-04-codigos-lista-nueva')
    await page.context().close()
  })

  test('1.3 · la cuenta entra con Google', async ({ browser }) => {
    const { user, pass } = CUENTAS.google
    test.skip(!user || !pass, 'Faltan CAPTURAS_USER_GOOGLE/CAPTURAS_PASS_GOOGLE.')
    const ctx = await browser.newContext(CONTEXTO)
    const page = await ctx.newPage()
    await page.goto(url('login'))
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
    await page.getByLabel('Correo').fill(user!)
    await page.getByLabel('Contraseña').fill(pass!)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByText('Esta cuenta entra con Google.', { exact: false })).toBeVisible()
    if (!(await page.getByRole('button', { name: 'Continuar con Google' }).or(page.getByRole('link', { name: 'Continuar con Google' })).isVisible())) {
      hallazgo('1.3 manda a «Continuar con Google» y ese botón no está en la pantalla de acceso')
    }
    await foto(page, '01-03-00-acceso-cuenta-google')
    await ctx.close()
  })

  // ─── 2 · Cuestionario de bienvenida (organización SIN razones sociales) ────

  test('2.1 y 2.2 · el cuestionario de bienvenida', async ({ browser }) => {
    const page = await abrir(browser, 'bienvenida')
    await page.goto(url('bienvenida'))
    await expect(page.getByRole('heading', { name: 'Antes de empezar' })).toBeVisible()

    // Paso 1: varias razones sociales. Paso 2: la operación NO está con ventas.
    await page.getByRole('radio', { name: 'Sí' }).first().check()
    await expect(page.getByText('¿La operación está en la misma razón social que comercializa o factura las ventas?')).toBeVisible()
    await page.getByRole('radio', { name: 'No' }).nth(1).check()

    // Paso 3: cinco campos. Se repite a propósito la misma empresa en dos
    // papeles, que es el caso normal según el propio manual.
    const campos = page.getByPlaceholder('Razón social')
    await expect(campos).toHaveCount(5)
    const nombres = [
      'Inmuebles DEMO Bienvenida, S.A. de C.V.',
      'Inmuebles DEMO Bienvenida, S.A. de C.V.',
      'Servicios DEMO Bienvenida, S.A. de C.V.',
      'Servicios DEMO Bienvenida, S.A. de C.V.',
      'Publicidad DEMO Bienvenida, S.A. de C.V.',
    ]
    for (let i = 0; i < 5; i++) await campos.nth(i).fill(nombres[i])

    const guardar = page.getByRole('button', { name: 'Guardar y continuar' })
    await expect(guardar).toBeEnabled()
    await foto(page, '02-01-03-bienvenida-cinco-campos', { completa: true })

    // 2.2: el botón para saltárselo vive en la misma vista; se recorta el pie.
    const saltar = page.getByRole('button', { name: 'Lo hago más tarde' })
    await expect(saltar).toBeVisible()
    await foto(page, '02-02-01-bienvenida-lo-hago-mas-tarde', { region: saltar.locator('xpath=..') })

    await guardar.click()
    // `exact`: sin él, «Razones sociales» casa con el encabezado «3. Indica las
    // razones sociales…» del propio cuestionario y la foto sale a mitad del
    // guardado (pasó en la primera corrida).
    // El manual dice que «te lleva a la pantalla Razones sociales». La
    // aplicación manda al inicio (`bienvenida/page.tsx`, `alTerminar`).
    await page.waitForURL((u) => !u.pathname.includes('/bienvenida'), { timeout: 20_000 })
    const destino = new URL(page.url()).pathname
    console.log(`MEDIDO-DESTINO-TRAS-CUESTIONARIO: ${destino}`)
    if (!destino.includes('/razones-sociales')) {
      hallazgo(`2.1: tras «Guardar y continuar» la aplicación lleva a ${destino}, no a «Razones sociales»`)
      await page.getByRole('navigation').getByRole('link', { name: 'Razones sociales' }).click()
    }
    await expect(page.getByRole('heading', { name: 'Razones sociales', exact: true })).toBeVisible()
    await expect(page.locator('li', { hasText: 'Publicidad DEMO Bienvenida' })).toBeVisible()
    await foto(page, '02-01-04-bienvenida-resultado')
    await page.context().close()
  })

  // ─── 3 · Razones sociales ──────────────────────────────────────────────────

  test('3 · gestionar razones sociales, la baja y los dos avisos', async ({ browser }) => {
    const page = await abrir(browser, 'dueno')
    await page.goto(url('razones-sociales'))
    await expect(page.getByRole('heading', { name: 'Razones sociales' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Nueva razón social' })).toBeVisible()
    const operativos = page.locator('li', { hasText: 'Servicios DEMO Operativos' })
    await expect(operativos).toBeVisible()
    await foto(page, '03-00-01-razones-sociales-sano')

    // 3.1: dar de baja la única dueña de Operación y de Licencias.
    await operativos.getByRole('button', { name: 'Dar de baja' }).click()
    await expect(operativos.getByRole('button', { name: 'Reactivar' })).toBeVisible()
    await foto(page, '03-01-03-razones-sociales-tras-baja')

    // 3.2: además, un papel compartido.
    await sinAvisos(page)
    const publicidad = page.locator('li', { hasText: 'Publicidad DEMO Exterior' })
    await publicidad.getByRole('button', { name: 'Editar' }).click()
    await page.getByRole('button', { name: 'Paga las rentas a los arrendadores' }).click()
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('lo tienen dos o más', { exact: false })).toBeVisible()
    await expect(page.getByText('Ninguna razón social activa tiene', { exact: false })).toBeVisible()
    await foto(page, '03-02-01-razones-sociales-avisos')

    // Se deja como estaba: el resto del manual se fotografía con el caso sano.
    await operativos.getByRole('button', { name: 'Reactivar' }).click()
    await expect(operativos.getByRole('button', { name: 'Dar de baja' })).toBeVisible()
    await publicidad.getByRole('button', { name: 'Editar' }).click()
    await page.getByRole('button', { name: 'Paga las rentas a los arrendadores' }).click()
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('lo tienen dos o más', { exact: false })).toHaveCount(0)
    await expect(page.getByText('Ninguna razón social activa tiene', { exact: false })).toHaveCount(0)
    await page.context().close()
  })

  // ─── 4 y 5 · Con qué razón social se paga cada renta ───────────────────────

  test('4.1 y 5 · asignar la razón social que paga un contrato', async ({ browser }) => {
    const page = await abrir(browser, 'dueno', 'contrato')
    await page.goto(url('arrendadores'))
    await expect(page.getByRole('heading', { name: 'Arrendadores', level: 1 })).toBeVisible()
    const tabla = page.getByRole('heading', { name: 'Contratos de arrendamiento' }).locator('xpath=following::table[1]')
    // Mural DEMO Viaducto es el único contrato de la semilla sin razón social.
    const fila = tabla.locator('tr', { hasText: 'Mural DEMO Viaducto' })
    await expect(fila).toBeVisible()
    await fila.click()

    const laPaga = page.locator('div', { has: page.locator('dt', { hasText: 'La paga' }) }).last()
    await expect(laPaga).toBeVisible()
    const textoAntes = (await laPaga.locator('dd').textContent())?.replace('Cambiar', '').trim()
    console.log(`MEDIDO-LA-PAGA-SIN-ASIGNAR: "${textoAntes}"`)
    if (textoAntes !== 'sin asignar') hallazgo(`el manual escribe «sin asignar» y la ficha dice «${textoAntes}»`)
    await foto(page, '04-01-02-contrato-la-paga')
    await foto(page, '05-00-01-contrato-sin-asignar', { region: laPaga.locator('xpath=ancestor::dl[1]') })

    await laPaga.getByRole('button', { name: 'Cambiar' }).click()
    const cuadro = page.getByRole('dialog', { name: 'Con cuál de tus razones sociales se paga' })
    await expect(cuadro).toBeVisible()
    const opcion = await cuadro.locator('option', { hasText: 'Inmuebles DEMO del Centro' }).getAttribute('value')
    await cuadro.getByRole('combobox').selectOption(opcion!)
    await foto(page, '04-01-04-contrato-elegir-razon-social')

    await cuadro.getByRole('button', { name: 'Guardar' }).click()
    // El manual: «El sistema te va a pedir tu contraseña otra vez». Lo que hay
    // que comprobar es DÓNDE se la pide: un cuadro con campo de contraseña, o
    // solo un texto.
    const candado = page.getByRole('dialog', { name: 'Desbloquear cambios' })
    const listo = page.getByText('Razón social asignada al contrato')
    const soloTexto = cuadro.getByText('Este cambio necesita que vuelvas a teclear tu contraseña.')
    await expect(candado.or(listo).or(soloTexto).first()).toBeVisible()
    if (await soloTexto.isVisible()) {
      await foto(page, '04-01-05-contrato-pide-contrasena')
      // ¿Hay en la barra superior un botón para teclearla?
      const botonBarra = page.locator('button[title="Los cambios de dinero y catálogo necesitan una contraseña"]')
      const hayBoton = (await botonBarra.count()) > 0
      hallazgo(
        `4.1: al guardar, el cuadro solo dice «Este cambio necesita que vuelvas a teclear tu contraseña.» y no trae campo; ` +
          `botón de desbloqueo en la barra superior: ${hayBoton ? 'sí' : 'NO'}`,
      )
      if (!hayBoton) {
        console.log('PENDIENTE-4.1-PASO-5: el Dueño no tiene dónde teclear la contraseña; el guardado no se completa')
        await page.context().close()
        return
      }
      // La ficha del contrato tapa la barra superior: hay que cerrarla, abrir el
      // candado y volver al contrato. Se hace como lo haría la persona.
      await cuadro.getByRole('button', { name: 'Cancelar' }).click()
      await page.keyboard.press('Escape')
      await expect(laPaga).toBeHidden()
      await botonBarra.click()
    }
    if (await candado.isVisible()) {
      await candado.getByLabel('Contraseña').fill(CUENTAS.dueno.pass!)
      await foto(page, '04-01-05-contrato-desbloquear-cambios')
      await candado.getByRole('button', { name: /Desbloquear/ }).click()
      await expect(candado).toBeHidden()
      if (!(await cuadro.isVisible())) {
        if (!(await laPaga.isVisible())) await fila.click()
        await laPaga.getByRole('button', { name: 'Cambiar' }).click()
        await cuadro.getByRole('combobox').selectOption(opcion!)
      }
      await cuadro.getByRole('button', { name: 'Guardar' }).click()
    } else if (!(await listo.isVisible())) {
      hallazgo('4.1 avisa de que se pide la contraseña al guardar, y no se pidió')
    }
    await expect(listo).toBeVisible()
    // «Salió bien si: La paga deja de decir sin asignar». Se le da a la ficha un
    // margen corto para refrescarse; si no lo hace, se reporta y se vuelve a
    // abrir el contrato, que es lo que tendría que hacer la persona.
    const refresco = await expect(laPaga.locator('dd'))
      .toContainText('Inmuebles DEMO del Centro', { timeout: 5_000 })
      .then(() => true, () => false)
    if (!refresco) {
      hallazgo('4.1: tras «Razón social asignada al contrato», la ficha sigue diciendo «Sin asignar» hasta que se vuelve a abrir')
      await page.reload()
      await expect(fila).toBeVisible()
      await fila.click()
      await expect(laPaga.locator('dd')).toContainText('Inmuebles DEMO del Centro')
    }
    await foto(page, '04-01-06-contrato-la-paga-asignada')
    await page.context().close()
  })

  test('4.2 · «Emite» bajo el folio del comprobante', async ({ browser }) => {
    const page = await abrir(browser, 'dueno')
    await page.goto(url('finanzas'))
    await expect(page.getByRole('heading', { name: 'Finanzas', level: 1 })).toBeVisible()
    // Pasos 1-4: la semilla no deja ninguna campaña lista para facturar (las
    // ocho ya tienen comprobante). Queda en capturas-pendientes.md.
    const vacia = page.getByText('Nada por facturar ahora')
    if (await vacia.isVisible()) console.log('PENDIENTE-4.2: «Listas para facturar» está vacía')
    const emite = page.getByText(/^Emite:/).first()
    await expect(emite).toBeVisible()
    await emite.scrollIntoViewIfNeeded()
    await foto(page, '04-02-05-comprobante-emite', { region: emite.locator('xpath=ancestor::*[self::li or self::tr][1]') })
    await page.context().close()
  })

  // ─── 6 · Actualizaciones ───────────────────────────────────────────────────

  test('6.1 y 6.2 · la tarjeta de actualizaciones y el modo', async ({ browser }) => {
    const page = await abrir(browser, 'dueno')
    await page.goto(url('administracion'))
    await page.getByRole('tab', { name: 'Configuración' }).click()
    const tarjeta = page.locator('div', { has: page.getByText('Actualizaciones', { exact: true }) })
      .filter({ has: page.getByRole('button', { name: 'Automatica' }) }).last()
    await expect(tarjeta).toBeVisible()
    console.log(`MEDIDO-FRASE-ACTUALIZACIONES: "${(await tarjeta.locator('span').first().textContent())?.trim()}"`)
    await foto(page, '06-01-01-actualizaciones-tarjeta', { region: tarjeta })

    await tarjeta.getByRole('button', { name: 'Automatica' }).click()
    await expect(page.getByText('Modo cambiado a automatica')).toBeVisible()
    // Los dos botones se deshabilitan mientras se guarda: la foto, cuando vuelven.
    await expect(tarjeta.getByRole('button', { name: 'Automatica' })).toBeEnabled()
    await expect(tarjeta.getByRole('button', { name: 'Con aprobacion' })).toBeEnabled()
    await foto(page, '06-02-02-actualizaciones-modo-automatica')

    // Se devuelve al modo por omisión.
    await tarjeta.getByRole('button', { name: 'Con aprobacion' }).click()
    await expect(page.getByText('Modo cambiado a con aprobacion')).toBeVisible()
    if (await tarjeta.getByRole('button', { name: /^Instalar/ }).count()) {
      console.log('INESPERADO: hay un botón «Instalar» en local')
    }
    await page.context().close()
  })

  // ─── 7 · Soporte ───────────────────────────────────────────────────────────

  test('7.1 y 7.2 · abrir un ticket y leer la respuesta', async ({ browser }) => {
    const page = await abrir(browser, 'dueno')
    await page.goto(url('administracion'))
    await page.getByRole('tab', { name: 'Configuración' }).click()
    // La tarjeta es el div más externo que contiene el título «Soporte» y NO la
    // de actualizaciones. Anclarla al botón «Nuevo ticket» no sirve: el botón
    // desaparece al abrir el formulario y el localizador se queda sin tarjeta.
    const tarjeta = page.locator('div', { has: page.getByText('Soporte', { exact: true }) })
      .filter({ hasNotText: 'Actualizaciones' }).first()
    await expect(tarjeta).toBeVisible()

    await tarjeta.getByRole('button', { name: 'Nuevo ticket' }).click()
    // Las etiquetas del formulario no están asociadas a su campo (`<label>` sin
    // `htmlFor`), así que se llega al campo desde el texto de la etiqueta.
    const campo = (etiqueta: string) => tarjeta.locator('label', { hasText: etiqueta }).locator('xpath=following-sibling::*[1]')
    const asunto = campo('Asunto')
    if ((await page.getByLabel('Asunto').count()) === 0) hallazgo('7.1: los campos «Asunto», «Cuéntanos qué pasa» y «Prioridad» no están asociados a su etiqueta (accesibilidad)')
    await asunto.fill('El reporte de rentabilidad no carga desde el viernes')
    await campo('Cuéntanos qué pasa').fill(
      'Estaba abriendo Reportes con el rango del segundo trimestre. Esperaba ver la tabla por pantalla ' +
        'y la pantalla se queda cargando. Pasa con cualquier mirada.',
    )
    await campo('Prioridad').selectOption({ label: 'Alta' })
    await foto(page, '07-01-04-soporte-formulario', { region: tarjeta })

    await tarjeta.getByRole('button', { name: 'Abrir ticket' }).click()
    await expect(page.getByText(/Ticket abierto/)).toBeVisible()
    await expect(tarjeta.getByText('Esperando respuesta de AS OOH.')).toBeVisible()
    await foto(page, '07-01-05-soporte-ticket-abierto')

    // 7.2: la respuesta la escribe AS OOH desde el panel de flota, que llama a
    // `PATCH /api/tickets` de la instancia con `x-flota-token`. Aquí se llama a
    // esa MISMA ruta del servidor local; solo se manda la respuesta, sin tocar
    // el estado, que es lo que el 7.3 dice que pasa.
    if (!FLOTA_TOKEN) {
      console.log('PENDIENTE-7.2: sin FLOTA_TOKEN no hay forma de que llegue una respuesta')
    } else {
      const lista = await page.request.get(url('api/tickets'))
      expect(lista.ok()).toBeTruthy()
      const cuerpo = await lista.json()
      const tickets = (Array.isArray(cuerpo) ? cuerpo : cuerpo.tickets) as { id: string; asunto: string }[]
      const t = tickets.find((x) => x.asunto.startsWith('El reporte de rentabilidad'))!
      // SIN cookies, como el panel: con la sesión del Dueño el middleware exige
      // CSRF (403) y la llamada ya no se parecería a la real.
      const panel = await pwRequest.newContext()
      const r = await panel.fetch(url('api/tickets'), {
        method: 'PATCH',
        headers: { 'x-flota-token': FLOTA_TOKEN, 'content-type': 'application/json' },
        data: {
          id: t.id,
          respuesta:
            'Gracias por el aviso. Lo reproducimos con el segundo trimestre y ya lo estamos corrigiendo; ' +
            'te escribimos por aquí en cuanto quede resuelto.',
        },
      })
      console.log(`MEDIDO-PATCH-TICKET: ${r.status()}`)
      expect(r.ok()).toBeTruthy()
      await panel.dispose()
      await page.reload()
      await page.getByRole('tab', { name: 'Configuración' }).click()
      await expect(tarjeta.getByText(/Respuesta de AS OOH/)).toBeVisible()
      await foto(page, '07-02-00-soporte-respuesta', { region: tarjeta })
    }
    await page.context().close()
  })

  // ─── 8 · Recibo de luz ─────────────────────────────────────────────────────

  test('8.1, 8.2 y 10.1 · capturar recibos (Operaciones)', async ({ browser }) => {
    const page = await abrir(browser, 'operaciones')
    await page.goto(url('energia'))
    await expect(page.getByRole('heading', { name: 'Consumo de luz' })).toBeVisible()
    const aviso = page.getByText(/Faltan \d+ de \d+ recibos/).first()
    await expect(aviso).toBeVisible()
    const antes = await aviso.textContent()
    await foto(page, '08-01-01-consumo-luz-rejilla', { completa: true })

    // El mes: el último mes cerrado dentro del periodo que abre la pantalla.
    const hasta = await page.locator('#hasta').inputValue()
    const [a, m] = hasta.split('-').map(Number)
    const mes = m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`

    const predio = page.getByLabel('Predio o pantalla')
    const valor = await predio.locator('option', { hasText: 'Predio DEMO Tlalpan' }).getAttribute('value')
    const capturar = async (medidor: string, kwh: string, importe: string) => {
      await predio.selectOption(valor!)
      await page.getByLabel('Mes del recibo').fill(mes)
      await page.getByLabel('Medidor').fill(medidor)
      await page.getByLabel('kWh').fill(kwh)
      await page.getByLabel('Importe').fill(importe)
    }

    await capturar('DEMO-MED-TLP-001', '640', '3968')
    await foto(page, '08-01-05-consumo-luz-formulario', { region: page.locator('form').first() })
    await page.getByRole('button', { name: 'Guardar recibo' }).click()
    await expect(aviso).not.toHaveText(antes!)
    console.log(`MEDIDO-AVISO-FALTANTES: antes "${antes}" · despues "${await aviso.textContent()}"`)
    await foto(page, '08-01-06-consumo-luz-guardado', { completa: true })

    // 8.2: un segundo medidor en el mismo predio y el mismo mes.
    await capturar('DEMO-MED-TLP-002', '85', '527')
    await page.getByRole('button', { name: 'Guardar recibo' }).click()
    const celda = page.locator('td', { hasText: 'DEMO-MED-TLP-002' })
    await expect(celda).toBeVisible()
    await foto(page, '08-02-00-consumo-luz-dos-medidores', { region: celda.locator('xpath=ancestor::tr[1]') })

    // 10.1: el mismo recibo otra vez.
    await capturar('DEMO-MED-TLP-001', '640', '3968')
    await page.getByRole('button', { name: 'Guardar recibo' }).click()
    const repetido = page.getByText('El registro ya existe', { exact: false })
    await expect(repetido).toBeVisible()
    await foto(page, '10-01-01-consumo-luz-registro-ya-existe', { region: page.locator('form').first() })
    await page.context().close()
  })

  test('8.3 · Operaciones intenta borrar un recibo (403)', async ({ browser }) => {
    const page = await abrir(browser, 'operaciones')
    await page.goto(url('energia'))
    await expect(page.getByRole('heading', { name: 'Consumo de luz' })).toBeVisible()
    const borrar = page.locator('button[title="Borrar este recibo"]').first()
    await expect(borrar).toBeVisible()
    await borrar.click()
    // Desde después del 21/09 borrar pide confirmación (ver la prueba del Dueño).
    const confirmar = page.getByRole('dialog', { name: 'Borrar este recibo' })
    await expect(confirmar).toBeVisible()
    await confirmar.getByRole('button', { name: 'Borrar el recibo' }).click()
    await expect(page.getByText('No tienes permiso para esta acción')).toBeVisible()
    const rejilla = await page.getByText(/Faltan \d+ de \d+ recibos/).count()
    console.log(`MEDIDO-403-REJILLA-SIGUE: ${rejilla > 0}`)
    await foto(page, '08-03-03-operaciones-borrar-403')
    await page.context().close()
  })

  test('8.3 · borrar un recibo (Dueño)', async ({ browser }) => {
    const page = await abrir(browser, 'dueno')
    await page.goto(url('energia'))
    await expect(page.getByRole('heading', { name: 'Consumo de luz' })).toBeVisible()
    const aviso = page.getByText(/Faltan \d+ de \d+ recibos/).first()
    await expect(aviso).toBeVisible()
    const antes = await aviso.textContent()
    // Se borra el segundo medidor que se capturó en la prueba anterior: así no
    // se toca ningún recibo de la semilla.
    const borrar = page.locator('button[title="Borrar este recibo"]', { hasText: 'DEMO-MED-TLP-002' })
    await expect(borrar).toBeVisible()
    await borrar.click()
    // El 21/09 NO había confirmación, y el manual lo dejó escrito en un aviso.
    // Hoy sí la hay: el cuadro «Borrar este recibo» con «Borrar el recibo».
    const confirmar = page.getByRole('dialog', { name: 'Borrar este recibo' })
    const hay = await expect(confirmar).toBeVisible({ timeout: 5_000 }).then(() => true, () => false)
    console.log(`MEDIDO-BORRADO-CON-CONFIRMACION: ${hay}`)
    if (hay) {
      hallazgo('8.3: borrar un recibo SÍ pide confirmación («Borrar este recibo» → «Borrar el recibo»); el aviso del 2026-09-21 del manual dice que no')
      await foto(page, '08-03-02-consumo-luz-confirmar-borrado')
      await confirmar.getByRole('button', { name: 'Borrar el recibo' }).click()
    }
    await expect(page.locator('button[title="Borrar este recibo"]', { hasText: 'DEMO-MED-TLP-002' })).toHaveCount(0)
    // Y el otro recibo de ese mes, también capturado por este guion: con los
    // dos fuera, la celda vuelve a ámbar y el contador sube, que es lo que el
    // manual describe.
    await page.locator('button[title="Borrar este recibo"]', { hasText: 'DEMO-MED-TLP-001' }).last().click()
    if (hay) await confirmar.getByRole('button', { name: 'Borrar el recibo' }).click()
    await expect(aviso).not.toHaveText(antes!)
    console.log(`MEDIDO-AVISO-TRAS-BORRAR: antes "${antes}" despues "${await aviso.textContent()}"`)
    await foto(page, '08-03-03-consumo-luz-tras-borrar', { completa: true })
    await page.context().close()
  })

  // ─── 9 · Reportes de rentabilidad ──────────────────────────────────────────

  test('9 · Operaciones intenta abrir /reportes/', async ({ browser }) => {
    const page = await abrir(browser, 'operaciones')
    await page.goto(url('reportes'))
    await page.waitForURL((u) => !u.pathname.replace(/\/$/, '').endsWith('/reportes'), { timeout: 15_000 })
    await expect(page.getByRole('navigation')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Operaciones', level: 1, exact: true })).toBeVisible()
    console.log(`MEDIDO-URL-TRAS-REPORTES: ${page.url()}`)
    await foto(page, '09-00-01-operaciones-intenta-reportes')
    await page.context().close()
  })

  test('9.1 a 9.6 · el reporte y sus miradas', async ({ browser }) => {
    const page = await abrir(browser, 'dueno')
    await page.goto(url('reportes'))
    await expect(page.getByRole('heading', { name: 'Reportes de rentabilidad' })).toBeVisible()
    const enCurso = page.getByText(/que está EN CURSO/)
    await expect(enCurso).toBeVisible()
    await expect(page.locator('table').first()).toBeVisible()
    await foto(page, '09-01-01-reportes-periodo-en-curso', { completa: true })

    const rango = async (desde: string, hasta: string) => {
      await page.getByLabel('Desde').fill(desde)
      await page.getByLabel('Hasta').fill(hasta)
    }
    const mirar = async (label: string) => {
      await page.getByLabel('Agrupar').selectOption({ label })
      await expect(page.locator('table').first()).toBeVisible()
    }

    // 9.2: un trimestre ya cerrado; el aviso ámbar tiene que irse.
    await rango('2026-04-01', '2026-06-30')
    await expect(enCurso).toHaveCount(0)
    await expect(page.locator('table').first()).toBeVisible()
    await foto(page, '09-02-01-reportes-trimestre-cerrado', { completa: true })

    // 9.3: las miradas, sobre los cuatro trimestres cerrados de la semilla.
    await rango('2025-07-01', '2026-06-30')
    await mirar('Por trimestre')
    await foto(page, '09-03-02-reportes-por-trimestre', { completa: true })
    await mirar('Por operación')
    await foto(page, '09-03-03-reportes-por-operacion', { completa: true })
    await mirar('Por metro cuadrado')
    const convencion = page.getByText('La superficie suma TODAS las caras', { exact: false })
    await expect(convencion).toBeVisible()
    await foto(page, '09-03-04-reportes-por-metro-cuadrado', { completa: true })
    // 9.4 y 9.5: los avisos encima de la tabla, recortados.
    // El recuadro de avisos: el elemento MÁS INTERNO que contiene la convención
    // y las exclusiones. Con `div` salía la tarjeta entera con su tabla: el
    // recuadro no es un div.
    await foto(page, '09-04-01-reportes-avisos', {
      region: page.locator('*').filter({ has: convencion }).filter({ hasText: 'Quedaron fuera' }).last(),
    })
    await mirar('Por consumo de luz')
    await foto(page, '09-03-05-reportes-por-consumo-de-luz', { completa: true })

    // 9.6: el desglose de una fila.
    await mirar('Por pantalla')
    await page.getByLabel('Periodos').selectOption({ label: 'Trimestral' })
    const desplegar = page.locator('button[title="Ver el desglose por periodo"]').first()
    await expect(desplegar).toBeVisible()
    await desplegar.click()
    await expect(page.locator('button[title="Ocultar el desglose por periodo"]')).toBeVisible()
    await foto(page, '09-06-01-reportes-desglose', { region: page.locator('table').first() })
    await page.context().close()
  })
})
