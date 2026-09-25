import { describe, it, expect, vi, afterEach } from 'vitest'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { confirmarConCandado } from '@/lib/cambios-candado'

// ============================================================================
//  «Con cual de tus razones sociales se paga» tiene que PINTAR el campo.
// ----------------------------------------------------------------------------
//  EL DEFECTO, para que no vuelva. Ese cuadro llamaba a `editarContratoApi`, el
//  servidor contestaba 403 con `requiereDesbloqueo` —el PATCH de contratos pasa
//  por `exigirCambioSensible`— y el `catch` pintaba el mensaje del servidor como
//  un error rojo: «Este cambio necesita que vuelvas a teclear tu contrasena.»
//  Y no habia donde teclearla. La palabra `password` no aparecia ni una vez en
//  las 1012 lineas de `ContratoSheet.tsx`. El camino directo estaba muerto y el
//  unico rodeo era salir de la ficha, ir a «Cambios bloqueados», desbloquear y
//  volver.
//
//  QUE SE AFIRMA AQUI, en dos piezas, porque este arnes no tiene DOM:
//
//   §1 · El campo RINDE un `<input type="password">` de verdad. Se rinde el
//        componente real con `react-dom/server`, igual que `ui/Button.test.ts`.
//   §2 · El cuadro del contrato lo USA, y delega el paso en el modulo probado
//        en vez de reescribirlo. Se lee el fuente —como hace
//        `ui/reset-bordes.test.ts` con `demo.css`— porque el modal va dentro de
//        un `Dialog.Portal` de Radix, que en servidor no rinde nada.
//
//  LO QUE NO AFIRMA, dicho con todas las letras: no hay navegador. Aqui no se
//  prueba que al pulsar «Guardar» aparezca el campo, ni que el foco caiga en el.
//  Eso se ve en pantalla o con las e2e, no aqui.
// ============================================================================

const FUENTE = readFileSync(join(__dirname, 'ContratoSheet.tsx'), 'utf8')

/**
 * El cuerpo de UN componente del archivo, desde su declaracion hasta la llave
 * que lo cierra. Se acota a proposito: que OTRO modal del mismo archivo tenga un
 * campo de contrasena no arregla este — y eso no es hipotetico, es exactamente
 * lo que pasaba el 2026-09-25 por la manana, con uno arreglado y dos rotos.
 *
 * El corte se hace en la ULTIMA llave a nivel de columna 0 antes del siguiente
 * componente, no en su declaracion: asi el bloque de comentarios que precede al
 * siguiente se queda FUERA. Si entrara, un comentario que mencione
 * `CampoContrasena` daria por buena una pantalla que no lo pinta.
 */
function cuerpoDe(nombre: string, siguiente: string): string {
  const desde = FUENTE.indexOf(`function ${nombre}(`)
  expect(desde, `${nombre} desaparecio o se renombro`).toBeGreaterThan(-1)
  const hasta = FUENTE.indexOf(`function ${siguiente}(`, desde)
  expect(hasta, `${siguiente} desaparecio o se renombro`).toBeGreaterThan(desde)
  const trozo = FUENTE.slice(desde, hasta)
  // El fin de linea se busca con `\r?\n` y NO con `\n` a secas: en esta maquina
  // `core.autocrlf=true` deja el arbol de trabajo en CRLF, asi que un
  // `lastIndexOf('\n}\n')` da -1 y la prueba se cae por el sistema de archivos,
  // no por el codigo. Es la misma trampa que tiene bloqueadas las migraciones
  // (ver el aviso de CRLF en `CLAUDE.md`), y aqui costo un rojo entero.
  let fin = -1
  const cierre = /\r?\n\}\r?\n/g
  for (let m = cierre.exec(trozo); m; m = cierre.exec(trozo)) fin = m.index
  expect(fin, `no se encontro el cierre de ${nombre}`).toBeGreaterThan(-1)
  return trozo.slice(0, fin)
}

function cuerpoDelModal(): string {
  return cuerpoDe('RazonSocialQuePagaModal', 'CompletarContratoModal')
}

// ─── 1 · el campo existe y es de contrasena ─────────────────────────────────
describe('1 · CampoContrasena rinde un input de contrasena de verdad', () => {
  async function html(props: Record<string, unknown> = {}) {
    const { CampoContrasena } = await import('@/components/demo/ui/CampoContrasena')
    return renderToStaticMarkup(
      React.createElement(CampoContrasena as never, { valor: '', onChange: () => {}, ...props }),
    )
  }

  it('sale un <input type="password">', async () => {
    // Esta es la linea que faltaba. Sin ella el cuadro pide algo que no se
    // puede escribir.
    expect(await html()).toContain('type="password"')
  })

  it('NO sale como texto plano', async () => {
    // Un `type="text"` enseñaria la contrasena en pantalla y la ofreceria al
    // autocompletado como si fuera un dato mas.
    const markup = await html()
    expect(markup).not.toContain('type="text"')
  })

  it('le dice al gestor de contrasenas que es la ACTUAL, no una nueva', async () => {
    // `current-password`: sin esto el navegador ofrece generar una nueva, que es
    // justo lo contrario de reautenticarse.
    //
    // Sin distinguir mayusculas a proposito, y MEDIDO el 2026-09-25:
    // `react-dom/server` 18.3.1 serializa este atributo como `autoComplete`, en
    // camelCase —`autofocus`, en cambio, si lo baja—. No es un defecto del
    // componente: los nombres de atributo de HTML no distinguen mayusculas, asi
    // que el navegador lo lee igual. Afirmarlo en minuscula daria un rojo que
    // no dice nada del codigo.
    expect(await html()).toMatch(/autocomplete="current-password"/i)
  })

  it('rinde el valor que le dan, para poder ser controlado', async () => {
    expect(await html({ valor: 'abc123' })).toContain('value="abc123"')
  })

  it('lleva una etiqueta visible, no solo un recuadro', async () => {
    const markup = await html()
    expect(markup).toContain('<label')
    expect(markup).toMatch(/contrase/i)
  })
})

// ─── 2 · el cuadro de la razon social lo usa ────────────────────────────────
describe('2 · el cuadro «con cual de tus razones sociales se paga» pide la clave', () => {
  it('pinta el campo de contrasena', () => {
    // El defecto exacto del 2026-09-25: pedia la contrasena y no la pintaba.
    expect(cuerpoDelModal()).toContain('<CampoContrasena')
  })

  it('delega el paso en `confirmarConCandado` en vez de reescribirlo', () => {
    // Cuarta copia a mano del mismo bailoteo = cuarta ocasion de olvidarse del
    // input. La secuencia esta probada en `lib/cambios-candado.test.ts`.
    expect(cuerpoDelModal()).toContain('confirmarConCandado(')
  })

  it('el boton de guardar no se puede pulsar con la contrasena en blanco', () => {
    // Segunda barrera, la visible. La primera —y la que de verdad corta— es
    // `confirmarConCandado`, que devuelve «falta-contrasena» sin llamar a nada.
    expect(cuerpoDelModal()).toMatch(/disabled=\{[^}]*reautenticando && !pass/)
  })

  it('el archivo importa las dos piezas', () => {
    expect(FUENTE).toContain("from '@/components/demo/ui/CampoContrasena'")
    expect(FUENTE).toContain("from '@/lib/cambios-candado'")
  })
})

// ─── 3 · «Completar contrato» ───────────────────────────────────────────────
//
//  El SEGUNDO de los tres cuadros del mismo archivo con el mismo defecto. Su
//  boton de guardar llama a `editarContratoApi` → `PATCH /api/contratos/:id`,
//  que pasa por `exigirCambioSensible` (`app/api/contratos/[id]/route.ts:25`).
//  Con el control de cambios encendido contestaba 403 y el `catch` pintaba el
//  mensaje del servidor como error rojo, sin ningun sitio donde teclear nada.
describe('3 · «Completar contrato de arrendamiento» pide la clave donde se teclea', () => {
  const cuerpo = () => cuerpoDe('CompletarContratoModal', 'AdjuntoInput')

  it('pinta el campo de contrasena', () => {
    expect(cuerpo()).toContain('<CampoContrasena')
  })

  it('delega el paso en `confirmarConCandado` en vez de reescribirlo', () => {
    expect(cuerpo()).toContain('confirmarConCandado(')
  })

  it('NO guarda el contrato por su cuenta: `editarContratoApi` solo va dentro del candado', () => {
    // EL NEGATIVO. Un `await editarContratoApi(...)` suelto en el cuerpo seria
    // el defecto de vuelta: guardaria sin pasar por el paso de la contrasena.
    // La unica invocacion legitima es la que `confirmarConCandado` recibe
    // inyectada y ejecuta DESPUES de desbloquear.
    expect(cuerpo()).not.toMatch(/await\s+editarContratoApi\(/)
    expect(cuerpo()).toMatch(/guardar:\s*\(\)\s*=>\s*\n?\s*editarContratoApi\(/)
  })

  it('el boton de guardar no se puede pulsar con la contrasena en blanco', () => {
    expect(cuerpo()).toMatch(/disabled=\{[^}]*reautenticando && !pass/)
  })

  it('cerrar OLVIDA lo tecleado — este modal NO se desmonta al cerrarse', () => {
    // `ContratoSheet` lo rinde siempre, con `open={completarOpen}`. Sin limpiar
    // a mano, la contrasena se quedaria viva en memoria hasta salir de la ficha.
    expect(cuerpo()).toMatch(/function cerrar\(\)[\s\S]{0,200}?setPass\(''\)/)
  })
})

// ─── 4 · «Registrar pago» — el que toca DINERO ──────────────────────────────
//
//  El TERCERO, y el grave. `registrarPagoRentaApi` → `POST
//  /api/pagos-renta/:id/pagar`, que pasa por `exigirCambioSensible`
//  (`app/api/pagos-renta/[id]/pagar/route.ts:14`). Ademas de no pintar el campo,
//  este cuadro mandaba el 403 a `onError()`, o sea a un TOAST que se desvanece:
//  el usuario ni siquiera conservaba en pantalla el mensaje que le decia que
//  hacia falta la contrasena.
describe('4 · «Registrar pago» pide la clave, y NO en un toast', () => {
  const cuerpo = () => cuerpoDe('PagoModal', 'ReportarIncidenciaModal')

  it('pinta el campo de contrasena', () => {
    expect(cuerpo()).toContain('<CampoContrasena')
  })

  it('delega el paso en `confirmarConCandado` en vez de reescribirlo', () => {
    expect(cuerpo()).toContain('confirmarConCandado(')
  })

  it('NO registra el pago por su cuenta: `registrarPagoRentaApi` solo va dentro del candado', () => {
    // EL NEGATIVO QUE IMPORTA, y el que vigila el dinero. Si vuelve a aparecer
    // un `await registrarPagoRentaApi(...)` suelto, el pago se sella sin pasar
    // por el paso de la contrasena.
    expect(cuerpo()).not.toMatch(/await\s+registrarPagoRentaApi\(/)
    expect(cuerpo()).toContain('confirmarConCandado(')
    expect(cuerpo()).toContain('registrarPagoRentaApi(')
  })

  it('el boton de registrar no se puede pulsar con la contrasena en blanco', () => {
    expect(cuerpo()).toMatch(/disabled=\{[^}]*reautenticando && !pass/)
  })

  it('el mensaje ya NO se va por un toast que se desvanece', () => {
    // Un toast no puede ser el sitio donde se pide una contrasena: desaparece
    // solo, y con el desaparece la instruccion. El error vive DENTRO del modal,
    // junto al campo, y se queda mientras el cuadro este abierto.
    expect(cuerpo()).not.toContain('onError(')
    expect(cuerpo()).toContain('text-error')
  })

  it('el componente ya no declara la salida `onError`', () => {
    // Si siguiera declarada, la siguiente mano la volveria a usar para esto.
    expect(cuerpo()).not.toMatch(/onError:\s*\(msg: string\) => void/)
  })
})

// ─── 5 · el negativo del dinero, ejecutado de verdad ────────────────────────
//
//  Los de arriba leen el fuente porque el modal vive dentro de un `Dialog.Portal`
//  de Radix y en servidor no rinde nada. Este no lee nada: CORRE la secuencia
//  real con el cliente real de `estado-api` y mira si sale un POST por la red.
//  Es la unica afirmacion de este archivo que no depende de como este escrito el
//  codigo, sino de lo que hace.
describe('5 · SIN contrasena no sale ni un POST a /pagos-renta/:id/pagar', () => {
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

  const datosDelPago = {
    fechaPago: '2026-09-25',
    metodoPago: 'TRANSFERENCIA',
    facturaUrl: null,
    comprobanteUrl: null,
    observaciones: null,
  }

  it('con la contrasena en blanco, el pago NO se registra', async () => {
    const llamadas = espiarRed()
    const { registrarPagoRentaApi } = await import('@/lib/data/estado-api')

    const r = await confirmarConCandado({
      reautenticando: true,
      contrasena: '',
      desbloquear: async () => {},
      guardar: () => registrarPagoRentaApi('pago-1', datosDelPago),
    })

    expect(r).toEqual({ estado: 'falta-contrasena' })
    // Ni una peticion. Ni al desbloqueo, ni al pago.
    expect(llamadas).toEqual([])
  })

  it('con la contrasena EQUIVOCADA, el pago NO se registra', async () => {
    const llamadas = espiarRed()
    const { registrarPagoRentaApi } = await import('@/lib/data/estado-api')

    const r = await confirmarConCandado({
      reautenticando: true,
      contrasena: 'la-que-no-es',
      desbloquear: async () => {
        throw new Error('Contrasena incorrecta')
      },
      guardar: () => registrarPagoRentaApi('pago-1', datosDelPago),
    })

    expect(r).toEqual({ estado: 'pedir-contrasena', error: 'Contrasena incorrecta' })
    // El fallo del desbloqueo CORTA: el POST del pago no llega a salir.
    expect(llamadas).toEqual([])
  })

  it('con la contrasena BUENA, el desbloqueo va PRIMERO y el pago DESPUES', async () => {
    // El orden no es cosmetico: al reves el POST volveria a chocar con el
    // candado y el cuadro se pediria dos veces con la clave ya tecleada.
    const orden: string[] = []
    globalThis.fetch = vi.fn(async (u: unknown) => {
      orden.push(String(u))
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as unknown as typeof fetch
    const { registrarPagoRentaApi } = await import('@/lib/data/estado-api')

    const r = await confirmarConCandado({
      reautenticando: true,
      contrasena: 'la-buena',
      desbloquear: async () => {
        orden.push('DESBLOQUEO')
      },
      guardar: () => registrarPagoRentaApi('pago-1', datosDelPago),
    })

    expect(r).toEqual({ estado: 'hecho' })
    expect(orden[0]).toBe('DESBLOQUEO')
    expect(orden.some((u) => u.includes('/pagos-renta/pago-1/pagar/'))).toBe(true)
  })
})
