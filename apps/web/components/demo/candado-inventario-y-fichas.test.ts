import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { confirmarConCandado } from '@/lib/cambios-candado'
import { MENSAJE_DESBLOQUEO } from '@/lib/cambios-mensajes'
import { crearLote } from '@/lib/cambios-lote'

// ============================================================================
//  B38 · los OCHO puntos que quedaban: inventario y fichas ya piden la clave.
// ----------------------------------------------------------------------------
//  EL DEFECTO, para que no vuelva. Catorce combinaciones ruta+metodo pasan por
//  el control de cambios y contestan 403 con `requiereDesbloqueo`. Los tres de
//  dinero y «Renovar» se cerraron el 25/09; aqui entran los ocho restantes:
//
//    5  · CeldaRenta            → PATCH  /api/contratos/:id
//    6  · lote de rentas        → PATCH  /api/contratos/:id  xN
//    7  · CeldaTarifa           → PATCH  /api/sitios/:id
//    8  · CeldaPropietario      → PATCH  /api/sitios/:id
//    9  · lote de tarifas       → PATCH  /api/sitios/:id     xN
//    10 · ContratoWizard        → POST   /api/contratos
//    11 · EditarSitioDialog     → PATCH  /api/sitios/:id
//    12 · eliminar pantalla     → DELETE /api/sitios/:id
//
//  Y LA TABLA DE B38 SE QUEDABA CORTA en cuatro de ellos, que es lo primero que
//  encontro esta tanda. Decia «se lo traga» y «toast», o sea que el mensaje se
//  perdia. No es eso: `actualizarSitioApi` y `borrarSitioApi` NO MIRABAN `r.ok`
//  (`lib/data/sitios-api.ts`), asi que un 403 se RESOLVIA como exito. La
//  pantalla no se quedaba callada: DECIA «Tarifa actualizada» con la tarifa sin
//  cambiar. Mentir es peor que callarse, y §4 lo fija para que no vuelva.
//
//  LO QUE HACE DISTINTO A ESTE LOTE, y es el trabajo de verdad: DOS de los ocho
//  (6 y 9) son OPERACIONES POR LOTE. Mandan N peticiones en paralelo, asi que
//  «una accion, un cuadro» no les vale tal cual. La politica adoptada, y lo que
//  estas pruebas vigilan, es:
//
//   a · La contrasena NO se pide de entrada. El candado esta apagado por defecto
//       en los tenants: preguntar siempre seria friccion inventada. Se manda el
//       lote y se deja que sea el servidor quien diga si hace falta.
//   b · Lo que el servidor rechazo NO se aplico. Lo que si paso se queda: no hay
//       vuelta atras del lado del cliente y fabricarla seria tocar el servidor.
//   c · EL REINTENTO MANDA SOLO LAS PENDIENTES, nunca el lote entero.
//   d · Y si el lote quedo A MEDIAS, se DICE CUANTAS. Un lote a medias y en
//       silencio —lo que hacia hasta hoy— es peor que no haber hecho nada.
//
//  QUE SE AFIRMA Y COMO. Las secciones 1-4 no leen el fuente: CORREN la
//  secuencia real con los clientes reales de `data/*-api` y `fetch` espiado, y
//  CUENTAN PETICIONES. Las 5-9 leen el fuente de cada pantalla, porque los
//  cuadros viven dentro de un `Dialog.Portal` de Radix que en servidor no rinde.
//
//  LO QUE NO AFIRMA, con todas las letras: no hay navegador. No se prueba que al
//  pulsar el boton aparezca el cuadro ni que el foco caiga en el campo.
// ============================================================================

const RAIZ = join(__dirname, '..', '..')
const fuente = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8')

const INVENTARIO = fuente('components/demo/inventario/InventarioTabla.tsx')
const WIZARD = fuente('components/demo/inventario/ContratoWizard.tsx')
const FICHA = fuente('components/demo/comercial/SiteFicha.tsx')

/**
 * El cuerpo de UN componente de un archivo, desde su declaracion hasta la llave
 * que lo cierra. Se acota a proposito: que OTRA celda del mismo archivo tenga
 * campo de contrasena no arregla esta — y eso no es hipotetico, es exactamente
 * lo que pasaba el 25/09 en `ContratoSheet.tsx`, con uno arreglado y dos rotos.
 *
 * Copiada de `candado-dinero-y-renovar.test.ts`, incluida su trampa: el fin de
 * linea se busca con `\r?\n` y NO con `\n` a secas, porque en esta maquina
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

/** Igual, para el ULTIMO componente del archivo: no hay «siguiente». */
function cuerpoFinal(archivo: string, nombre: string): string {
  const desde = archivo.indexOf(`function ${nombre}(`)
  expect(desde, `${nombre} desaparecio o se renombro`).toBeGreaterThan(-1)
  return archivo.slice(desde)
}

// ─── el arnes de red, compartido por las cuatro primeras secciones ──────────

const fetchOriginal = globalThis.fetch

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const BLOQUEADO = () => json({ error: MENSAJE_DESBLOQUEO, requiereDesbloqueo: true }, 403)

/**
 * Sustituye `fetch` por un espia que APUNTA cada escritura y contesta lo que
 * diga `responder`. El refresco del estado (`/api/estado/`) se contesta vacio y
 * NO se apunta: no es una escritura y contarlo enturbiaria el recuento, que es
 * justo lo que estas pruebas miden.
 */
function espiarRed(responder: (url: string, init?: RequestInit) => Response) {
  const llamadas: string[] = []
  globalThis.fetch = vi.fn(async (u: unknown, init?: RequestInit) => {
    const url = String(u)
    if (url.includes('/api/estado')) return json({})
    llamadas.push(url)
    return responder(url, init)
  }) as unknown as typeof fetch
  return llamadas
}

afterEach(() => {
  globalThis.fetch = fetchOriginal
})

// ─── 1 · el lote de TARIFAS (punto 9) ───────────────────────────────────────
describe('1 · lote de tarifas: con el candado NO cambia ninguna, y se puede terminar', () => {
  const ITEMS = [
    { id: 's1', tarifa: 100 },
    { id: 's2', tarifa: 200 },
    { id: 's3', tarifa: 300 },
  ]

  async function loteDeTarifas() {
    const { actualizarTarifasApi } = await import('@/lib/data/sitios-api')
    return crearLote({
      items: ITEMS,
      aplicar: actualizarTarifasApi,
      unidad: 'pantalla',
      unidadPlural: 'pantallas',
    })
  }

  it('el 403 del candado NO se traga: el lote lo levanta como «falta desbloquear»', async () => {
    const llamadas = espiarRed(BLOQUEADO)
    const lote = await loteDeTarifas()
    const r = await confirmarConCandado({
      reautenticando: false,
      contrasena: '',
      desbloquear: async () => {},
      guardar: lote.paso,
    })
    // Lo que importa: NO es `error`. Es «pide la contrasena», que es lo que abre
    // el cuadro. Hasta hoy el lote decia «0 aplicadas» sin decir por que.
    expect(r).toEqual({ estado: 'pedir-contrasena', error: null })
    expect(llamadas).toHaveLength(3)
    expect(lote.aplicadas()).toBe(0)
    expect(lote.pendientes()).toBe(3)
  })

  it('SIN contrasena el reintento no manda NI UNA peticion mas', async () => {
    espiarRed(BLOQUEADO)
    const lote = await loteDeTarifas()
    await confirmarConCandado({
      reautenticando: false, contrasena: '', desbloquear: async () => {}, guardar: lote.paso,
    })
    const llamadas = espiarRed(BLOQUEADO)
    const r = await confirmarConCandado({
      reautenticando: true,
      contrasena: '',
      desbloquear: async () => {},
      guardar: lote.paso,
    })
    expect(r).toEqual({ estado: 'falta-contrasena' })
    expect(llamadas).toEqual([])
    expect(lote.aplicadas()).toBe(0)
  })

  it('con la contrasena EQUIVOCADA tampoco sale ni una: el desbloqueo corta', async () => {
    espiarRed(BLOQUEADO)
    const lote = await loteDeTarifas()
    await confirmarConCandado({
      reautenticando: false, contrasena: '', desbloquear: async () => {}, guardar: lote.paso,
    })
    const llamadas = espiarRed(BLOQUEADO)
    const r = await confirmarConCandado({
      reautenticando: true,
      contrasena: 'la-que-no-es',
      desbloquear: async () => {
        throw new Error('Contrasena incorrecta')
      },
      guardar: lote.paso,
    })
    expect(r).toEqual({ estado: 'pedir-contrasena', error: 'Contrasena incorrecta' })
    expect(llamadas).toEqual([])
    expect(lote.aplicadas()).toBe(0)
  })

  it('tras desbloquear se aplican las TRES y el desbloqueo va PRIMERO', async () => {
    espiarRed(BLOQUEADO)
    const lote = await loteDeTarifas()
    await confirmarConCandado({
      reautenticando: false, contrasena: '', desbloquear: async () => {}, guardar: lote.paso,
    })
    const orden: string[] = []
    globalThis.fetch = vi.fn(async (u: unknown) => {
      const url = String(u)
      if (url.includes('/api/estado')) return json({})
      orden.push(url)
      return json({ ok: true })
    }) as unknown as typeof fetch
    const r = await confirmarConCandado({
      reautenticando: true,
      contrasena: 'la-buena',
      desbloquear: async () => {
        orden.push('DESBLOQUEO')
      },
      guardar: lote.paso,
    })
    expect(r).toEqual({ estado: 'hecho' })
    expect(orden[0]).toBe('DESBLOQUEO')
    expect(orden.filter((u) => u.includes('/api/sitios/'))).toHaveLength(3)
    expect(lote.aplicadas()).toBe(3)
    expect(lote.pendientes()).toBe(0)
  })
})

// ─── 2 · lo que NO puede pasar: un lote a medias EN SILENCIO ────────────────
//
//  Esta seccion es el corazon del encargo. Si la mitad de las tarifas cambio y
//  la otra mitad no, y nadie lo dice, eso es peor que no haber hecho nada.
describe('2 · un lote a medias SE DICE, y el reintento manda SOLO lo que falta', () => {
  /** Bloquea los que se le digan; los demas pasan. Asi queda a medias de verdad. */
  function mediaTabla(bloqueados: string[]) {
    return (url: string) =>
      bloqueados.some((id) => url.includes(`/${id}/`)) ? BLOQUEADO() : json({ ok: true })
  }

  async function loteDeTarifas() {
    const { actualizarTarifasApi } = await import('@/lib/data/sitios-api')
    return crearLote({
      items: [
        { id: 's1', tarifa: 100 },
        { id: 's2', tarifa: 200 },
        { id: 's3', tarifa: 300 },
      ],
      aplicar: actualizarTarifasApi,
      unidad: 'pantalla',
      unidadPlural: 'pantallas',
    })
  }

  it('el reintento manda SOLO las dos pendientes, no las tres', async () => {
    espiarRed(mediaTabla(['s2', 's3']))
    const lote = await loteDeTarifas()
    await confirmarConCandado({
      reautenticando: false, contrasena: '', desbloquear: async () => {}, guardar: lote.paso,
    })
    expect(lote.aplicadas()).toBe(1)
    expect(lote.pendientes()).toBe(2)

    const llamadas = espiarRed(() => json({ ok: true }))
    const r = await confirmarConCandado({
      reautenticando: true, contrasena: 'la-buena', desbloquear: async () => {}, guardar: lote.paso,
    })
    expect(r).toEqual({ estado: 'hecho' })
    // LA AFIRMACION QUE DECIDE: `s1` ya se aplico y NO se vuelve a mandar.
    expect(llamadas).toHaveLength(2)
    expect(llamadas.some((u) => u.includes('/s1/'))).toBe(false)
    expect(llamadas.some((u) => u.includes('/s2/'))).toBe(true)
    expect(llamadas.some((u) => u.includes('/s3/'))).toBe(true)
    expect(lote.aplicadas()).toBe(3)
  })

  it('las que YA se aplicaron se cuentan y se dicen, con su numero', async () => {
    espiarRed(mediaTabla(['s3']))
    const lote = await loteDeTarifas()
    await confirmarConCandado({
      reautenticando: false, contrasena: '', desbloquear: async () => {}, guardar: lote.paso,
    })
    expect(lote.aplicadas()).toBe(2)
    expect(lote.frase()).toBe('Se aplicó en 2 de 3 pantallas; 1 sin cambiar.')
  })

  it('si el fallo NO es el candado, el lote a medias sale como ERROR con la cuenta', async () => {
    // Un 500 no se arregla tecleando la contrasena: no se pide. Pero tampoco se
    // calla, que es lo que hacia el `catch {}` de antes.
    espiarRed((url) => (url.includes('/s3/') ? json({ error: 'Se cayo la base' }, 500) : json({ ok: true })))
    const lote = await loteDeTarifas()
    const r = await confirmarConCandado({
      reautenticando: false, contrasena: '', desbloquear: async () => {}, guardar: lote.paso,
    })
    expect(r).toEqual({ estado: 'error', error: 'Se aplicó en 2 de 3 pantallas; 1 sin cambiar.' })
  })

  it('cuando TODAS pasan no hay frase de a medias que ensenar', async () => {
    espiarRed(() => json({ ok: true }))
    const lote = await loteDeTarifas()
    const r = await confirmarConCandado({
      reautenticando: false, contrasena: '', desbloquear: async () => {}, guardar: lote.paso,
    })
    expect(r).toEqual({ estado: 'hecho' })
    expect(lote.pendientes()).toBe(0)
    expect(lote.aplicadas()).toBe(3)
  })
})

// ─── 3 · el lote de RENTAS (punto 6), la misma politica sobre contratos ─────
describe('3 · lote de rentas: mismo trato, sobre `PATCH /api/contratos/:id`', () => {
  async function loteDeRentas() {
    const { actualizarRentasApi } = await import('@/lib/data/estado-api')
    return crearLote({
      items: [
        { contratoId: 'c1', montoRenta: 1000 },
        { contratoId: 'c2', montoRenta: 2000 },
      ],
      aplicar: actualizarRentasApi,
      unidad: 'contrato',
      unidadPlural: 'contratos',
    })
  }

  it('con el candado no cambia NINGUNA renta y se pide la contrasena', async () => {
    const llamadas = espiarRed(BLOQUEADO)
    const lote = await loteDeRentas()
    const r = await confirmarConCandado({
      reautenticando: false, contrasena: '', desbloquear: async () => {}, guardar: lote.paso,
    })
    expect(r).toEqual({ estado: 'pedir-contrasena', error: null })
    expect(llamadas).toHaveLength(2)
    expect(llamadas.every((u) => u.includes('/contratos/'))).toBe(true)
    expect(lote.aplicadas()).toBe(0)
  })

  it('sin contrasena, el reintento no toca NINGUN contrato', async () => {
    espiarRed(BLOQUEADO)
    const lote = await loteDeRentas()
    await confirmarConCandado({
      reautenticando: false, contrasena: '', desbloquear: async () => {}, guardar: lote.paso,
    })
    const llamadas = espiarRed(BLOQUEADO)
    const r = await confirmarConCandado({
      reautenticando: true, contrasena: '', desbloquear: async () => {}, guardar: lote.paso,
    })
    expect(r).toEqual({ estado: 'falta-contrasena' })
    expect(llamadas).toEqual([])
  })

  it('a medias: `c1` ya cambio, el reintento solo manda `c2`', async () => {
    espiarRed((url) => (url.includes('/c2/') ? BLOQUEADO() : json({ ok: true })))
    const lote = await loteDeRentas()
    await confirmarConCandado({
      reautenticando: false, contrasena: '', desbloquear: async () => {}, guardar: lote.paso,
    })
    expect(lote.frase()).toBe('Se aplicó en 1 de 2 contratos; 1 sin cambiar.')
    const llamadas = espiarRed(() => json({ ok: true }))
    await confirmarConCandado({
      reautenticando: true, contrasena: 'la-buena', desbloquear: async () => {}, guardar: lote.paso,
    })
    expect(llamadas).toHaveLength(1)
    expect(llamadas[0]).toContain('/c2/')
  })
})

// ─── 4 · los clientes sueltos ya NO se tragan el 403 (ni lo llaman exito) ───
describe('4 · una sola pantalla: el 403 llega, y no disfrazado de exito', () => {
  it('`actualizarSitioApi` DECIA que habia guardado con un 403 delante', async () => {
    // El peor de los ocho, y la tabla de B38 no lo sabia: no miraba `r.ok`, asi
    // que la promesa se resolvia y la celda cantaba «Tarifa actualizada» con la
    // tarifa sin tocar. Callarse es malo; mentir es peor.
    const llamadas = espiarRed(BLOQUEADO)
    const { actualizarSitioApi } = await import('@/lib/data/sitios-api')
    await expect(actualizarSitioApi('s1', { tarifaMensual: 999 })).rejects.toThrow(MENSAJE_DESBLOQUEO)
    expect(llamadas).toHaveLength(1)
  })

  it('`borrarSitioApi` tambien: el 403 no llegaba ni al `catch` de la ficha', async () => {
    const llamadas = espiarRed(BLOQUEADO)
    const { borrarSitioApi } = await import('@/lib/data/sitios-api')
    await expect(borrarSitioApi('s1')).rejects.toThrow(MENSAJE_DESBLOQUEO)
    expect(llamadas).toHaveLength(1)
  })

  it('y el candado lo RECONOCE: es «pide la clave», no un error rojo', async () => {
    espiarRed(BLOQUEADO)
    const { borrarSitioApi } = await import('@/lib/data/sitios-api')
    const r = await confirmarConCandado({
      reautenticando: false, contrasena: '', desbloquear: async () => {},
      guardar: () => borrarSitioApi('s1'),
    })
    expect(r).toEqual({ estado: 'pedir-contrasena', error: null })
  })

  it('un fallo que NO es el candado sigue saliendo con su mensaje', async () => {
    espiarRed(() => json({ error: 'La pantalla tiene reservas' }, 409))
    const { borrarSitioApi } = await import('@/lib/data/sitios-api')
    await expect(borrarSitioApi('s1')).rejects.toThrow('La pantalla tiene reservas')
  })

  it('sin contrasena NO se borra ninguna pantalla', async () => {
    const llamadas = espiarRed(BLOQUEADO)
    const { borrarSitioApi } = await import('@/lib/data/sitios-api')
    const r = await confirmarConCandado({
      reautenticando: true, contrasena: '', desbloquear: async () => {},
      guardar: () => borrarSitioApi('s1'),
    })
    expect(r).toEqual({ estado: 'falta-contrasena' })
    expect(llamadas).toEqual([])
  })

  it('sin contrasena NO se cambia la tarifa de una pantalla', async () => {
    const llamadas = espiarRed(BLOQUEADO)
    const { actualizarSitioApi } = await import('@/lib/data/sitios-api')
    const r = await confirmarConCandado({
      reautenticando: true, contrasena: '', desbloquear: async () => {},
      guardar: () => actualizarSitioApi('s1', { tarifaMensual: 999 }),
    })
    expect(r).toEqual({ estado: 'falta-contrasena' })
    expect(llamadas).toEqual([])
  })

  it('sin contrasena NO se cambia el arrendador de una pantalla', async () => {
    const llamadas = espiarRed(BLOQUEADO)
    const { actualizarSitioApi } = await import('@/lib/data/sitios-api')
    const r = await confirmarConCandado({
      reautenticando: true, contrasena: '', desbloquear: async () => {},
      guardar: () => actualizarSitioApi('s1', { arrendadorId: 'a9' }),
    })
    expect(r).toEqual({ estado: 'falta-contrasena' })
    expect(llamadas).toEqual([])
  })

  it('sin contrasena NO se crea el contrato del asistente', async () => {
    const llamadas = espiarRed(BLOQUEADO)
    const { crearContratoConSitioApi } = await import('@/lib/data/estado-api')
    const r = await confirmarConCandado({
      reautenticando: true, contrasena: '', desbloquear: async () => {},
      guardar: () =>
        crearContratoConSitioApi({
          arrendador: { id: 'a1' },
          predio: { id: 'p1' },
          contrato: {
            fechaInicio: '2026-01-01', fechaFin: '2026-12-31',
            montoRenta: 1, periodicidad: 'MENSUAL',
          },
          sitio: { id: 's1' },
        }),
    })
    expect(r).toEqual({ estado: 'falta-contrasena' })
    expect(llamadas).toEqual([])
  })

  it('sin contrasena NO se edita la renta de un contrato', async () => {
    const llamadas = espiarRed(BLOQUEADO)
    const { editarContratoApi } = await import('@/lib/data/estado-api')
    const r = await confirmarConCandado({
      reautenticando: true, contrasena: '', desbloquear: async () => {},
      guardar: () => editarContratoApi('c1', { montoRenta: 500 }),
    })
    expect(r).toEqual({ estado: 'falta-contrasena' })
    expect(llamadas).toEqual([])
  })
})

// ─── 5 · las tres celdas en linea del inventario (puntos 5, 7 y 8) ──────────
describe('5 · `InventarioTabla`: las tres celdas piden la clave', () => {
  /**
   * Que el cuadro esté DECLARADO no basta: tiene que estar RENDIDO, y en TODAS
   * las ramas de `return` de la celda.
   *
   * Esto no es purismo, es un mutante que sobrevivió: cambiar `{dialogo}` por
   * `{null}` en las dos ramas de `CeldaTarifa` dejaba las 37 en verde, porque el
   * `toContain('<DialogoCandado')` seguía casando con la línea que lo declara —
   * y la celda había vuelto a no tener dónde teclear la contraseña. Se cuentan
   * los `{dialogo}`, uno por rama.
   */
  function exigeCuadroEnCadaRama(c: string, ramas: number) {
    expect(c).toContain('<DialogoCandado')
    expect(c.match(/\{dialogo\}/g) ?? []).toHaveLength(ramas)
    expect(c.match(/return \(/g) ?? []).toHaveLength(ramas)
  }

  it('`CeldaRenta` pasa por el candado y ABRE su cuadro en sus DOS ramas', () => {
    const c = cuerpoDe(INVENTARIO, 'CeldaRenta', 'CeldaTarifa')
    expect(c).toContain('useCandado()')
    expect(c).toContain('candado.ejecutar(')
    exigeCuadroEnCadaRama(c, 2)
    // Y ya no llama a `editarContratoApi` por fuera del candado.
    expect(c).not.toMatch(/await\s+editarContratoApi/)
  })

  it('`CeldaTarifa` pasa por el candado y ABRE su cuadro en sus DOS ramas', () => {
    const c = cuerpoDe(INVENTARIO, 'CeldaTarifa', 'CeldaPropietario')
    expect(c).toContain('useCandado()')
    expect(c).toContain('candado.ejecutar(')
    exigeCuadroEnCadaRama(c, 2)
    expect(c).not.toMatch(/await\s+actualizarSitioApi/)
  })

  it('`CeldaTarifa` ya no se traga el motivo: el fallo sale por `alFallar`', () => {
    // Era `catch { onSaved('No se pudo actualizar la tarifa') }`: el mensaje del
    // servidor se perdia entero y quien lo leia no sabia que hacer.
    const c = cuerpoDe(INVENTARIO, 'CeldaTarifa', 'CeldaPropietario')
    expect(c).toContain('alFallar:')
    // La CLAUSULA, no la palabra: `/catch\s*\{/` a secas casaba con el propio
    // comentario que explica el defecto («se tragaba el 403 con un `catch {}`»)
    // y daba la prueba por buena con el `catch` mudo todavia en su sitio.
    expect(c).not.toMatch(/\}\s*catch\s*\{/)
  })

  it('`CeldaPropietario` pasa por el candado y ABRE su cuadro en sus TRES ramas', () => {
    const c = cuerpoFinal(INVENTARIO, 'CeldaPropietario')
    expect(c).toContain('useCandado()')
    expect(c).toContain('candado.ejecutar(')
    exigeCuadroEnCadaRama(c, 3)
    expect(c).not.toMatch(/await\s+actualizarSitioApi/)
    expect(c).not.toMatch(/\}\s*catch\s*\{/)
  })
})

// ─── 6 · los dos lotes, cableados en la pantalla ────────────────────────────
describe('6 · `InventarioTabla`: los dos lotes usan la politica y no `catch {}`', () => {
  const cuerpo = () => cuerpoDe(INVENTARIO, 'InventarioTabla', 'CeldaRenta')

  it('el lote de tarifas se arma con `crearLote` sobre `actualizarTarifasApi`', () => {
    expect(cuerpo()).toMatch(/crearLote\(\{[\s\S]{0,400}?aplicar: actualizarTarifasApi/)
  })

  it('el lote de rentas se arma con `crearLote` sobre `actualizarRentasApi`', () => {
    expect(cuerpo()).toMatch(/crearLote\(\{[\s\S]{0,400}?aplicar: actualizarRentasApi/)
  })

  it('los dos lotes pasan por el candado', () => {
    // Dos `ejecutar`, uno por lote: uno solo dejaria al otro sin cuadro, que es
    // exactamente la forma que tuvo este defecto en `ContratoSheet.tsx`.
    const c = cuerpo()
    expect(c.match(/candado\.ejecutar\(/g) ?? []).toHaveLength(2)
  })

  it('ya no queda el `catch {}` mudo de ninguno de los dos lotes', () => {
    // El de `bajar()` genera el archivo en el navegador y NO habla con el
    // servidor, asi que ese se queda. Se afirma sobre los dos que si hablaban.
    expect(INVENTARIO).not.toMatch(/notify\('No se pudo aplicar el cambio masivo'\)/)
    expect(INVENTARIO).not.toMatch(/notify\('No se pudo aplicar el cambio masivo de renta'\)/)
  })

  it('el cuadro del candado de los lotes se rinde en la pantalla', () => {
    expect(cuerpo()).toContain('<DialogoCandado')
  })
})

// ─── 7 · el asistente de contrato (punto 10) ───────────────────────────────
describe('7 · `ContratoWizard`: el campo va DENTRO del asistente', () => {
  it('usa el candado y pinta el bloque en su propio pie, no un cuadro nuevo', () => {
    // El asistente YA es el cuadro donde se confirma: la regla dice que el campo
    // va dentro, igual que en los dos de finanzas.
    expect(WIZARD).toContain('useCandado()')
    expect(WIZARD).toContain('<PasoContrasena')
    expect(WIZARD).toContain('candado.ejecutar(')
  })

  it('el boton de crear repite la accion pendiente en vez de armar otra', () => {
    // Importa: `crear()` vuelve a leer el formulario. Si el usuario tocara algo
    // durante el paso de la contrasena, confirmar guardaria OTRA cosa de la que
    // se pidio. Confirmar tiene que ser `reintentar()`.
    expect(WIZARD).toMatch(/candado\.reautenticando\s*\?\s*\(\)\s*=>\s*void candado\.reintentar\(\)/)
  })

  it('el boton no se puede pulsar con la contrasena en blanco', () => {
    expect(WIZARD).toMatch(/candado\.reautenticando && !candado\.pass/)
  })
})

// ─── 8 · la ficha de la pantalla (puntos 11 y 12) ──────────────────────────
describe('8 · `SiteFicha`: editar y eliminar piden la clave', () => {
  it('`EditarSitioDialog` pinta el bloque DENTRO del modal que ya tenia', () => {
    const c = cuerpoDe(FICHA, 'EditarSitioDialog', 'CampoEdit')
    expect(c).toContain('useCandado()')
    expect(c).toContain('<PasoContrasena')
    expect(c).toContain('candado.ejecutar(')
    expect(c).not.toMatch(/await\s+actualizarSitioApi\(sitio\.id, cambios\)/)
  })

  it('el boton de guardar de la ficha repite la accion pendiente', () => {
    const c = cuerpoDe(FICHA, 'EditarSitioDialog', 'CampoEdit')
    expect(c).toMatch(/candado\.reautenticando\s*\?\s*\(\)\s*=>\s*void candado\.reintentar\(\)/)
    expect(c).toMatch(/candado\.reautenticando && !candado\.pass/)
  })

  it('eliminar pide la clave DENTRO del `ConfirmDialog`, sin abrir otro cuadro', () => {
    const c = cuerpoDe(FICHA, 'SiteFicha', 'EditarSitioDialog')
    expect(c).toContain('useCandado()')
    expect(c).toContain('<PasoContrasena')
    expect(c).toMatch(/candado\.reautenticando\s*\?\s*\(\)\s*=>\s*void candado\.reintentar\(\)/)
  })

  it('el boton de eliminar no se puede pulsar con la contrasena en blanco', () => {
    const c = cuerpoDe(FICHA, 'SiteFicha', 'EditarSitioDialog')
    expect(c).toMatch(/confirmDeshabilitado=\{candado\.reautenticando && !candado\.pass\}/)
  })
})

// ─── 9 · el cuadro de un lote no esconde lo que ya paso ────────────────────
describe('9 · antes de pedir la clave, el cuadro dice cuantas se aplicaron', () => {
  it('el subtitulo del cuadro de lote se CALCULA, no es un texto fijo', () => {
    // Si el lote quedo a medias, quien teclea la contrasena tiene que saber que
    // parte YA se aplico. Un subtitulo fijo lo callaria.
    const c = cuerpoDe(INVENTARIO, 'InventarioTabla', 'CeldaRenta')
    expect(c).toMatch(/subtitulo=\{[^}]*lote/)
  })
})
