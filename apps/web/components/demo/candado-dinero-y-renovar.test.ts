import { describe, it, expect, vi, afterEach } from 'vitest'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { confirmarConCandado } from '@/lib/cambios-candado'

// ============================================================================
//  B38 · los TRES caminos de DINERO y el boton «Renovar» ya piden la clave.
// ----------------------------------------------------------------------------
//  EL DEFECTO, para que no vuelva. Catorce combinaciones ruta+metodo pasan por
//  `exigirCambioSensible` y contestan 403 con `requiereDesbloqueo`. Doce puntos
//  de llamada NO ofrecian ningun sitio donde teclear la contrasena: pintaban el
//  mensaje del servidor como un error cualquiera, o se lo tragaban. Aqui entran
//  los cuatro que el dueno aprobo el 2026-09-25:
//
//    1 · `PagosRentaCard`      → POST /api/pagos-renta/:id/pagar   (DINERO)
//    2 · `GenerarFacturaDialog`→ POST /api/campanas/:id/facturar   (DINERO)
//    3 · `PagoModal` (finanzas)→ POST /api/cobranzas/:id/pagar     (DINERO)
//    4 · «Renovar»             → POST /api/contratos/:id/renovar
//
//  LO QUE HACE DISTINTO A ESTE LOTE. Los tres cuadros arreglados el 25/09 por la
//  manana eran MODALES: habia un sitio evidente donde poner el campo. Dos de
//  estos cuatro —«Registrar pago» de la tabla de rentas y «Renovar»— son botones
//  de UN CLIC, sin cuadro ninguno. La regla que se adopta, y que estas pruebas
//  vigilan, es UNA sola:
//
//    La contrasena se pide DENTRO del cuadro donde se confirma la accion.
//    Si la accion no tiene cuadro, el 403 ABRE uno, atado a esa accion exacta.
//
//  Por eso la pieza compartida (`components/demo/ui/candado.tsx`) expone las dos
//  caras de lo mismo: `PasoContrasena` (el bloque, para un cuadro que ya existe)
//  y `DialogoCandado` (el cuadro que aparece cuando no habia ninguno). El campo
//  es el mismo `CampoContrasena` y la secuencia es la misma
//  `confirmarConCandado`, que NO se reescribe.
//
//  EL CUARTO ES EL PEOR Y NO ES DE DINERO. «Renovar» era
//  `await iniciarRenovacionApi(...)` seguido de `onToast(...)`, SIN `try/catch`.
//  Un 403 —o un 500, o la red caida— rechazaba la promesa, el toast nunca
//  llegaba y no pasaba absolutamente nada: no se distinguia de un boton roto.
//  Son DOS defectos y aqui se afirman los dos: que cualquier fallo se VE (§7) y
//  que ademas ofrece el campo (§4).
//
//  QUE SE AFIRMA Y COMO, porque este arnes no tiene DOM:
//
//   §1 · Se RINDE de verdad `PasoContrasena` con `react-dom/server`.
//   §2-§6 · Se LEE el fuente de cada pantalla —igual que hace
//        `candado-contrato.test.ts`— porque los modales viven dentro de un
//        `Dialog.Portal` de Radix, que en servidor no rinde nada.
//   §7 · No se lee nada: se CORRE la secuencia real con los clientes reales de
//        `estado-api` y `fetch` espiado. Es la unica parte que no depende de
//        como este escrito el codigo, sino de lo que hace.
//
//  LO QUE NO AFIRMA, con todas las letras: no hay navegador. No se prueba que al
//  pulsar el boton aparezca el cuadro, ni que el foco caiga en el campo. Eso se
//  ve en pantalla o con las e2e.
// ============================================================================

const RAIZ = join(__dirname, '..', '..')
const fuente = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8')

const CANDADO = fuente('components/demo/ui/candado.tsx')
const PAGOS_RENTA = fuente('components/demo/arrendadores/PagosRentaCard.tsx')
const CONTRATO_SHEET = fuente('components/demo/arrendadores/ContratoSheet.tsx')
const FINANZAS = fuente('app/(app)/(shell)/finanzas/page.tsx')

/**
 * El cuerpo de UN componente de un archivo, desde su declaracion hasta la llave
 * que lo cierra. Se acota a proposito: que OTRO cuadro del mismo archivo tenga
 * campo de contrasena no arregla este — y eso no es hipotetico, es exactamente
 * lo que pasaba el 25/09 por la manana en `ContratoSheet.tsx`, con uno arreglado
 * y dos rotos.
 *
 * Copiada de `arrendadores/candado-contrato.test.ts`, incluida su trampa: el fin
 * de linea se busca con `\r?\n` y NO con `\n` a secas, porque en esta maquina
 * `core.autocrlf=true` deja el arbol en CRLF y un `lastIndexOf('\n}\n')` da -1;
 * la prueba se caeria por el sistema de archivos y no por el codigo.
 */
function cuerpoDe(archivo: string, nombre: string, siguiente: string): string {
  const desde = archivo.indexOf(`function ${nombre}(`)
  expect(desde, `${nombre} desaparecio o se renombro`).toBeGreaterThan(-1)
  const hasta = archivo.indexOf(`function ${siguiente}(`, desde)
  expect(hasta, `${siguiente} desaparecio o se renombro`).toBeGreaterThan(desde)
  const trozo = archivo.slice(desde, hasta)
  let fin = -1
  const cierre = /\r?\n\}\r?\n/g
  for (let m = cierre.exec(trozo); m; m = cierre.exec(trozo)) fin = m.index
  expect(fin, `no se encontro el cierre de ${nombre}`).toBeGreaterThan(-1)
  return trozo.slice(0, fin)
}

// ─── 1 · el bloque del paso de la contrasena RINDE el campo ─────────────────
//
//  Es la pieza que usan las cuatro pantallas, en sus dos envases. Si esto no
//  pinta un `<input type="password">`, ninguna de las cuatro lo pinta.
describe('1 · `PasoContrasena` rinde el campo de verdad', () => {
  function candadoFalso(extra: Record<string, unknown> = {}) {
    return {
      reautenticando: true,
      pass: '',
      setPass: () => {},
      error: null,
      enviando: false,
      ejecutar: async () => ({ estado: 'hecho' as const }),
      reintentar: async () => null,
      olvidar: () => {},
      ...extra,
    }
  }

  async function html(extra: Record<string, unknown> = {}) {
    const { PasoContrasena } = await import('@/components/demo/ui/candado')
    return renderToStaticMarkup(
      React.createElement(PasoContrasena as never, { candado: candadoFalso(extra) }),
    )
  }

  it('sale un <input type="password">', async () => {
    expect(await html()).toContain('type="password"')
  })

  it('NO sale como texto plano', async () => {
    expect(await html()).not.toContain('type="text"')
  })

  it('dice por que se pide, no solo pone un recuadro', async () => {
    // Un campo de contrasena que aparece de golpe sin explicacion se lee como un
    // fallo de sesion. La frase es la que ya usan los tres cuadros del 25/09.
    expect(await html()).toMatch(/contrase/i)
  })

  it('ensena el error del servidor cuando lo hay', async () => {
    // «Contrasena incorrecta» tiene que quedarse A LA VISTA junto al campo. En
    // un toast se desvanece y con el se va la unica instruccion util.
    expect(await html({ error: 'Contrasena incorrecta' })).toContain('Contrasena incorrecta')
  })

  it('NO pinta nada mientras el servidor no la haya pedido', async () => {
    // EL NEGATIVO de esta seccion: el candado esta APAGADO por defecto en los
    // tenants. Pedir la contrasena de entrada seria friccion inventada, y
    // ademas ensena a teclearla sin que nadie la pida.
    expect(await html({ reautenticando: false })).toBe('')
  })
})

// ─── 2 · el cuadro que aparece cuando no habia cuadro ───────────────────────
describe('2 · `DialogoCandado` es un cuadro de verdad, atado a la accion pendiente', () => {
  it('es un `Modal`, no un toast ni un rotulo en la barra', () => {
    expect(CANDADO).toContain('<Modal')
    expect(CANDADO).toContain('<PasoContrasena')
  })

  it('se abre SOLO cuando el servidor pidio la clave', () => {
    expect(CANDADO).toMatch(/open=\{candado\.reautenticando\}/)
  })

  it('el boton de confirmar no se puede pulsar con la contrasena en blanco', () => {
    // Segunda barrera, la visible. La primera —y la que de verdad corta— es
    // `confirmarConCandado`, que devuelve «falta-contrasena» sin llamar a nada.
    expect(CANDADO).toMatch(/disabled=\{candado\.enviando \|\| !candado\.pass\}/)
  })

  it('confirmar REPITE la accion que el servidor rechazo, no una nueva', () => {
    // `reintentar()` reproduce el `guardar` capturado cuando llego el 403. Si
    // en su lugar se armara una accion nueva, lo que se confirma podria no ser
    // lo que se pidio — y esto sella pagos.
    expect(CANDADO).toContain('candado.reintentar()')
  })

  it('cerrar OLVIDA lo tecleado', () => {
    // El cuadro no se desmonta: lo rinde siempre el padre con
    // `open={candado.reautenticando}`.
    expect(CANDADO).toMatch(/function olvidar\(\)[\s\S]{0,300}?setPass\(''\)/)
  })

  it('delega la secuencia en `confirmarConCandado` y no la reescribe', () => {
    expect(CANDADO).toContain("from '@/lib/cambios-candado'")
    expect(CANDADO).toContain('confirmarConCandado(')
  })

  it('el desbloqueo va por el cliente real, no por uno inventado aqui', () => {
    expect(CANDADO).toContain('desbloquear: desbloquearApi')
  })
})

// ─── 3 · «Registrar pago» de la tabla de rentas — DINERO, y de un clic ──────
//
//  POST /api/pagos-renta/:id/pagar, con `exigirCambioSensible`
//  (`app/api/pagos-renta/[id]/pagar/route.ts:14`). Es el boton que se usa a
//  diario desde la lista: el cuadro que se arreglo el 25/09 por la manana es el
//  camino MENOS transitado de los dos.
describe('3 · `PagosRentaCard` pide la clave', () => {
  it('abre el cuadro del candado', () => {
    expect(PAGOS_RENTA).toContain('<DialogoCandado')
    expect(PAGOS_RENTA).toContain("from '@/components/demo/ui/candado'")
  })

  it('NO registra el pago por su cuenta: la llamada solo va dentro del candado', () => {
    // EL NEGATIVO QUE VIGILA EL DINERO. Si vuelve a aparecer un
    // `await registrarPagoRentaApi(...)` suelto, el pago se sella sin pasar por
    // el paso de la contrasena.
    expect(PAGOS_RENTA).not.toMatch(/await\s+registrarPagoRentaApi\(/)
    expect(PAGOS_RENTA).toMatch(/guardar:\s*\(\)\s*=>\s*registrarPagoRentaApi\(/)
  })

  it('cualquier fallo se sigue viendo', () => {
    expect(PAGOS_RENTA).toMatch(/alFallar:/)
  })
})

// ─── 4 · «Renovar» — el peor de los doce ────────────────────────────────────
//
//  POST /api/contratos/:id/renovar, con `exigirCambioSensible`
//  (`app/api/contratos/[id]/renovar/route.ts:14`). No es dinero, pero era el
//  unico de los doce SIN `try/catch`: pulsabas y no pasaba nada.
describe('4 · «Renovar» pide la clave y ya no se come los fallos', () => {
  const cuerpo = () => cuerpoDe(CONTRATO_SHEET, 'ContratoSheet', 'RazonSocialQuePagaModal')

  it('abre el cuadro del candado', () => {
    expect(cuerpo()).toContain('<DialogoCandado')
  })

  it('NO renueva por su cuenta: la llamada solo va dentro del candado', () => {
    // El defecto exacto: `await iniciarRenovacionApi(contrato.id)` a pelo en el
    // `onClick`, sin `catch`.
    expect(cuerpo()).not.toMatch(/await\s+iniciarRenovacionApi\(/)
    expect(cuerpo()).toMatch(/guardar:\s*\(\)\s*=>\s*iniciarRenovacionApi\(/)
  })

  it('CUALQUIER fallo llega al usuario, no solo el del candado', () => {
    // El segundo defecto, y el que no es del candado: antes ni el 500 ni la red
    // caida decian nada. `alFallar` es la unica salida que queda para eso.
    expect(cuerpo()).toMatch(/alFallar:\s*\(m\) => onToast\(m\)/)
  })
})

// ─── 5 · «Emitir factura» — DINERO, y con cuadro propio ─────────────────────
//
//  POST /api/campanas/:id/facturar, con `exigirCambioSensible`
//  (`app/api/campanas/[id]/facturar/route.ts:15`). Aqui SI habia cuadro, asi que
//  el campo va dentro y no se abre otro encima.
describe('5 · «Emitir factura» pide la clave dentro de su propio cuadro', () => {
  const cuerpo = () => cuerpoDe(FINANZAS, 'GenerarFacturaDialog', 'PagoModal')

  it('pinta el paso de la contrasena dentro del cuadro', () => {
    expect(cuerpo()).toContain('<PasoContrasena')
  })

  it('NO abre un segundo cuadro encima del que ya hay', () => {
    // Un modal sobre otro modal pelea por el foco de Radix y, sobre todo, tapa
    // los datos que se estan confirmando.
    expect(cuerpo()).not.toContain('<DialogoCandado')
  })

  it('NO factura por su cuenta: la llamada solo va dentro del candado', () => {
    // EL NEGATIVO. Un comprobante emitido no se deshace.
    expect(cuerpo()).not.toMatch(/await\s+generarFacturaApi\(/)
    expect(cuerpo()).toMatch(/guardar:\s*\(\)\s*=>\s*\n?\s*generarFacturaApi\(/)
  })

  it('el boton de confirmar no se puede pulsar con la contrasena en blanco', () => {
    expect(cuerpo()).toMatch(/candado\.reautenticando && !candado\.pass/)
  })

  it('confirmar REPITE lo que el servidor rechazo', () => {
    // Se afirma sobre el BOTON, no sobre el archivo: `candado.reintentar()`
    // aparece tambien en el `onEnter` del campo, asi que un `toContain` a secas
    // se lo traga todo. Medido con un mutante que SOBREVIVIO a esa version.
    expect(cuerpo()).toMatch(/candado\.reautenticando \? candado\.reintentar\(\)/)
  })
})

// ─── 6 · «Registrar abono» de una cobranza — DINERO, y con cuadro propio ────
//
//  POST /api/cobranzas/:id/pagar, con `exigirCambioSensible`
//  (`app/api/cobranzas/[id]/pagar/route.ts:15`).
describe('6 · «Registrar pago» de cobranza pide la clave dentro de su cuadro', () => {
  const cuerpo = () => cuerpoDe(FINANZAS, 'PagoModal', 'FilaCuota')

  it('pinta el paso de la contrasena dentro del cuadro', () => {
    expect(cuerpo()).toContain('<PasoContrasena')
  })

  it('NO cobra por su cuenta: la llamada solo va dentro del candado', () => {
    expect(cuerpo()).not.toMatch(/await\s+pagarCobranzaApi\(/)
    expect(cuerpo()).toMatch(/guardar:\s*\(\)\s*=>\s*pagarCobranzaApi\(/)
  })

  it('confirmar REPITE la accion pendiente: liquidar total y abonar NO son lo mismo', () => {
    // Aqui hay DOS botones de accion. Si el paso de la contrasena dejara elegir
    // otra vez, se podria confirmar una accion distinta de la que el servidor
    // rechazo — y una es liquidar TODO el saldo.
    //
    // Se afirma sobre el BOTON, y no con un `toContain` sobre el archivo:
    // `candado.reintentar()` aparece tambien en el `onEnter` del campo, asi que
    // la version floja sobrevivia al mutante que cambiaba el boton por
    // `pagar(true)` — o sea, a liquidar el saldo entero sin haberlo pedido.
    expect(cuerpo()).toMatch(
      /onClick=\{\(\) => void candado\.reintentar\(\)\}[\s\S]{0,160}Confirmar y registrar/,
    )
  })

  it('el boton de confirmar no se puede pulsar con la contrasena en blanco', () => {
    expect(cuerpo()).toMatch(/candado\.reautenticando && !candado\.pass/)
  })
})

// ─── 7 · los negativos, EJECUTADOS contra la red ────────────────────────────
//
//  Lo de arriba lee el fuente. Esto no lee nada: corre la secuencia real con los
//  clientes reales de `estado-api` y un `fetch` espiado, y mira si sale una
//  peticion. Es lo unico de este archivo que no depende de como este escrito el
//  codigo, sino de lo que hace.
describe('7 · SIN contrasena no sale NI UNA peticion', () => {
  const fetchOriginal = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = fetchOriginal
  })

  /** Sustituye `fetch` por un espia que APUNTA cada llamada y revienta. Si el
   *  candado se rompiera, la llamada quedaria registrada aqui. */
  function espiarRed(): string[] {
    const llamadas: string[] = []
    globalThis.fetch = vi.fn(async (u: unknown) => {
      llamadas.push(String(u))
      throw new Error('la red no deberia usarse en esta prueba')
    }) as unknown as typeof fetch
    return llamadas
  }

  it('con la contrasena en blanco NO se sella el pago de renta', async () => {
    const llamadas = espiarRed()
    const { registrarPagoRentaApi } = await import('@/lib/data/estado-api')
    const r = await confirmarConCandado({
      reautenticando: true,
      contrasena: '',
      desbloquear: async () => {},
      guardar: () => registrarPagoRentaApi('pago-1'),
    })
    expect(r).toEqual({ estado: 'falta-contrasena' })
    expect(llamadas).toEqual([])
  })

  it('con la contrasena en blanco NO se emite la factura', async () => {
    const llamadas = espiarRed()
    const { generarFacturaApi } = await import('@/lib/data/estado-api')
    const r = await confirmarConCandado({
      reautenticando: true,
      contrasena: '',
      desbloquear: async () => {},
      guardar: () => generarFacturaApi('camp-1', 90, null, null),
    })
    expect(r).toEqual({ estado: 'falta-contrasena' })
    expect(llamadas).toEqual([])
  })

  it('con la contrasena en blanco NO se cobra la cobranza', async () => {
    const llamadas = espiarRed()
    const { pagarCobranzaApi } = await import('@/lib/data/estado-api')
    const r = await confirmarConCandado({
      reautenticando: true,
      contrasena: '',
      desbloquear: async () => {},
      guardar: () => pagarCobranzaApi('cob-1'),
    })
    expect(r).toEqual({ estado: 'falta-contrasena' })
    expect(llamadas).toEqual([])
  })

  it('con la contrasena EQUIVOCADA tampoco sale el POST de ninguno de los tres', async () => {
    const { registrarPagoRentaApi, generarFacturaApi, pagarCobranzaApi } = await import(
      '@/lib/data/estado-api'
    )
    const guardas: (() => Promise<unknown>)[] = [
      () => registrarPagoRentaApi('pago-1'),
      () => generarFacturaApi('camp-1', 90, null, null),
      () => pagarCobranzaApi('cob-1'),
    ]
    for (const guardar of guardas) {
      const llamadas = espiarRed()
      const r = await confirmarConCandado({
        reautenticando: true,
        contrasena: 'la-que-no-es',
        desbloquear: async () => {
          throw new Error('Contrasena incorrecta')
        },
        guardar,
      })
      // El fallo del desbloqueo CORTA: el POST no llega a salir.
      expect(r).toEqual({ estado: 'pedir-contrasena', error: 'Contrasena incorrecta' })
      expect(llamadas).toEqual([])
    }
  })

  it('con la contrasena BUENA, el desbloqueo va PRIMERO y el cobro DESPUES', async () => {
    // El orden no es cosmetico: al reves el POST volveria a chocar con el
    // candado y la clave se pediria dos veces ya tecleada.
    const orden: string[] = []
    globalThis.fetch = vi.fn(async (u: unknown) => {
      orden.push(String(u))
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as unknown as typeof fetch
    const { pagarCobranzaApi } = await import('@/lib/data/estado-api')
    const r = await confirmarConCandado({
      reautenticando: true,
      contrasena: 'la-buena',
      desbloquear: async () => {
        orden.push('DESBLOQUEO')
      },
      guardar: () => pagarCobranzaApi('cob-1', 100),
    })
    expect(r).toEqual({ estado: 'hecho' })
    expect(orden[0]).toBe('DESBLOQUEO')
    expect(orden.some((u) => u.includes('/cobranzas/cob-1/pagar/'))).toBe(true)
  })
})

// ─── 8 · «Renovar»: el fallo vuelve como VALOR, no como promesa rechazada ───
//
//  Este es el segundo defecto del boton, y el que no tiene que ver con el
//  candado. Antes la promesa se rechazaba y nadie la recogia. Ahora
//  `confirmarConCandado` DEVUELVE el fallo, que es lo que permite ensenarlo.
describe('8 · cualquier fallo de la renovacion se puede ver', () => {
  const fetchOriginal = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = fetchOriginal
  })

  it('un 500 del servidor vuelve como `error` con su mensaje, sin lanzar', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'El contrato ya esta renovado' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch
    const { iniciarRenovacionApi } = await import('@/lib/data/estado-api')

    const r = await confirmarConCandado({
      reautenticando: false,
      contrasena: '',
      desbloquear: async () => {},
      guardar: () => iniciarRenovacionApi('con-1'),
      mensajeSiFalla: 'No se pudo iniciar la renovacion',
    })

    expect(r).toEqual({ estado: 'error', error: 'El contrato ya esta renovado' })
  })

  it('la red caida tampoco se pierde en silencio', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('Failed to fetch')
    }) as unknown as typeof fetch
    const { iniciarRenovacionApi } = await import('@/lib/data/estado-api')

    const r = await confirmarConCandado({
      reautenticando: false,
      contrasena: '',
      desbloquear: async () => {},
      guardar: () => iniciarRenovacionApi('con-1'),
      mensajeSiFalla: 'No se pudo iniciar la renovacion',
    })

    expect(r).toEqual({ estado: 'error', error: 'Failed to fetch' })
  })

  it('el 403 del candado NO se confunde con un fallo: pide la clave', async () => {
    const { MENSAJE_DESBLOQUEO } = await import('@/lib/cambios-mensajes')
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: MENSAJE_DESBLOQUEO, requiereDesbloqueo: true }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch
    const { iniciarRenovacionApi } = await import('@/lib/data/estado-api')

    const r = await confirmarConCandado({
      reautenticando: false,
      contrasena: '',
      desbloquear: async () => {},
      guardar: () => iniciarRenovacionApi('con-1'),
    })

    expect(r).toEqual({ estado: 'pedir-contrasena', error: null })
  })
})
