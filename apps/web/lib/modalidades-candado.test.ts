import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { confirmarConCandado } from '@/lib/cambios-candado'
import { MENSAJE_DESBLOQUEO } from '@/lib/cambios-mensajes'

// ============================================================================
//  UNA MODALIDAD ES UNA TARIFA — y por eso pasa por el mismo candado.
// ----------------------------------------------------------------------------
//  LA TRAMPA, escrita para que no se repita. `app/api/sitios/[id]/route.ts`
//  protege por CAMPO: una lista blanca (`CAMPOS_SENSIBLES`) con
//  `tarifaPublicada`, `tarifaMensual`, `costoCompra`, `precioM2`,
//  `tarifaImpresion`, `arrendadorId` y `predioId`. Tocar uno de ésos exige la
//  contraseña; editar el nombre o las notas no, para no cobrarle fricción al
//  trabajo diario.
//
//  `sitio_modalidades.tarifa_publicada` es EL MISMO DINERO que
//  `sitios.tarifa_publicada`, solo que por unidad de venta. Si la captura desde
//  la ficha hubiera entrado por ese PATCH añadiendo una cadena más a la lista,
//  habría quedado una puerta trasera de libro: cambiar el precio de una pantalla
//  sin contraseña pasando por las modalidades. Y peor: una lista blanca es
//  frágil por construcción — se protege lo que alguien se acordó de escribir, y
//  el día que llegue `tarifaPorHora` nadie se acordará.
//
//  LA DECISIÓN: las modalidades NO entran por el PATCH general. Tienen su propia
//  ruta, `PATCH /api/sitios/[id]/modalidades`, y esa ruta es sensible ENTERA —
//  `exigirCambioSensible`, sin lista de campos. No hay nada que olvidarse de
//  añadir: todo lo que entre por ahí pide contraseña. Y el PATCH general RECHAZA
//  el campo en vez de ignorarlo, para que la puerta no quede entornada.
//
//  Se usa `exigirCambioSensible` (o sea `exigirDesbloqueo`) y NO
//  `exigirReautenticacionSiempre`: el trato tiene que ser EXACTAMENTE el de
//  `tarifaPublicada`, ni más estricto ni más laxo. Pedir más aquí que para la
//  tarifa escalar del mismo dinero sería una incoherencia que alguien acabaría
//  «arreglando» por el lado malo.
//
//  LO QUE ESTAS PRUEBAS NO AFIRMAN, con todas las letras: no hay navegador. No
//  se prueba que el cuadro aparezca al pulsar ni que el foco caiga en el campo.
// ============================================================================

const RAIZ = join(__dirname, '..')
const fuente = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8')

const RUTA_MODALIDADES = fuente('app/api/sitios/[id]/modalidades/route.ts')
const RUTA_SITIO = fuente('app/api/sitios/[id]/route.ts')
const CONTROLLER = fuente('lib/server/sitios-controller.ts')
const REPO = fuente('lib/server/sitios-repo.ts')
const FICHA = fuente('components/demo/comercial/SiteFicha.tsx')

// ─── 1 · la ruta es sensible ENTERA, no por lista de campos ──────────────────
describe('1 · la ruta de modalidades pide la contraseña siempre', () => {
  it('pasa por `exigirCambioSensible` con el permiso de inventario', () => {
    expect(RUTA_MODALIDADES).toMatch(
      /exigirCambioSensible\(\s*'inventario'\s*,\s*'crear'\s*\)/,
    )
  })

  it('y NO tiene ninguna lista de campos que decida si hace falta o no', () => {
    // El modo de fallo que se evita: una lista blanca protege lo que alguien
    // recordó escribir. Aquí no hay nada que recordar.
    expect(RUTA_MODALIDADES).not.toMatch(/CAMPOS_SENSIBLES/)
    expect(RUTA_MODALIDADES).not.toMatch(/tocaDinero/)
  })

  it('el guard va ANTES de llamar al controller', () => {
    // Un guard escrito después de la escritura no es un guard.
    const guard = RUTA_MODALIDADES.indexOf('exigirCambioSensible')
    const ctrl = RUTA_MODALIDADES.indexOf('actualizarModalidadesCtrl(')
    expect(guard).toBeGreaterThan(-1)
    expect(ctrl).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(ctrl)
  })

  it('no exporta ningún método sin guard', () => {
    // Si mañana se añade un DELETE o un POST a este archivo, tiene que llevar
    // el suyo. Se cuentan los `export async function` y los guards.
    const metodos = RUTA_MODALIDADES.match(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g) ?? []
    const guards = RUTA_MODALIDADES.match(/exigirCambioSensible\(/g) ?? []
    expect(metodos.length).toBeGreaterThan(0)
    expect(guards.length).toBe(metodos.length)
  })
})

// ─── 2 · la puerta trasera queda CERRADA, no entornada ───────────────────────
describe('2 · por el PATCH general las modalidades NO entran', () => {
  it('`CAMPO_COL` no mapea ninguna modalidad: no hay columna que escribir', () => {
    // `actualizarSitio` recorre el cuerpo contra `CAMPO_COL` y se salta lo que
    // no conoce. Es la defensa de fondo, y se fija para que nadie la debilite
    // «añadiendo el campo que falta».
    const campoCol = REPO.slice(REPO.indexOf('const CAMPO_COL'), REPO.indexOf('export async function actualizarSitio'))
    expect(campoCol).not.toMatch(/modalidad/i)
  })

  it('el PATCH general RECHAZA el campo en vez de ignorarlo en silencio', () => {
    // Ignorarlo devolvería 200 con la tarifa intacta: el mismo «mentir en vez
    // de callarse» que costó el arreglo del 25/09 (B38).
    expect(CONTROLLER).toMatch(/modalidadesDetalle/)
  })

  it('y la ruta general conserva su lista de campos sensibles intacta', () => {
    // El arreglo no debilita lo que ya protegía. Las siete siguen ahí.
    for (const campo of [
      'tarifaPublicada', 'tarifaMensual', 'costoCompra',
      'precioM2', 'tarifaImpresion', 'arrendadorId', 'predioId',
    ]) {
      expect(RUTA_SITIO, campo).toMatch(new RegExp(`'${campo}'`))
    }
  })

  it('la ruta general NO adquiere `modalidadesDetalle` en su lista blanca', () => {
    // Si algún día aparece ahí, es que alguien deshizo esta decisión: el campo
    // volvería a poder viajar por el PATCH general, y una lista blanca con un
    // nombre mal escrito deja de proteger sin que nada falle.
    const lista = RUTA_SITIO.slice(
      RUTA_SITIO.indexOf('const CAMPOS_SENSIBLES'),
      RUTA_SITIO.indexOf('export async function PATCH'),
    )
    expect(lista).not.toMatch(/modalidad/i)
  })
})

// ─── 3 · el cliente de la API no se traga el 403 ─────────────────────────────
const fetchOriginal = globalThis.fetch

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const BLOQUEADO = () => json({ error: MENSAJE_DESBLOQUEO, requiereDesbloqueo: true }, 403)

/** Espía cada escritura; el refresco de estado se contesta vacío y no se apunta. */
function espiarRed(responder: (url: string, init?: RequestInit) => Response) {
  const llamadas: { url: string; cuerpo: unknown }[] = []
  globalThis.fetch = vi.fn(async (u: unknown, init?: RequestInit) => {
    const url = String(u)
    if (url.includes('/api/estado')) return json({})
    llamadas.push({ url, cuerpo: init?.body ? JSON.parse(String(init.body)) : null })
    return responder(url, init)
  }) as unknown as typeof fetch
  return llamadas
}

afterEach(() => {
  globalThis.fetch = fetchOriginal
})

describe('3 · `actualizarModalidadesApi` mira `r.ok` y devuelve el mensaje TAL CUAL', () => {
  it('un 403 del candado se levanta como error, no como éxito', async () => {
    // El defecto de B38, exacto: `actualizarSitioApi` no miraba `r.ok` y un 403
    // se resolvía como guardado. La pantalla cantaba «tarifa actualizada» con la
    // tarifa intacta. Aquí eso no puede nacer otra vez.
    espiarRed(BLOQUEADO)
    const { actualizarModalidadesApi } = await import('@/lib/data/sitios-api')
    await expect(
      actualizarModalidadesApi('S1', { guardar: [{ unidad: 'spot', tarifaPublicada: 250 }] }),
    ).rejects.toThrow(MENSAJE_DESBLOQUEO)
  })

  it('el mensaje llega SIN reescribir: si no, el candado no lo reconoce', async () => {
    // `esErrorDeDesbloqueo` compara por texto. Un mensaje propio («no se pudo
    // guardar») convertiría el 403 en un error rojo sin campo donde teclear.
    espiarRed(BLOQUEADO)
    const { actualizarModalidadesApi } = await import('@/lib/data/sitios-api')
    const { esErrorDeDesbloqueo } = await import('@/lib/cambios-candado')
    const e = await actualizarModalidadesApi('S1', { quitar: ['spot'] }).catch((x) => x)
    expect(esErrorDeDesbloqueo(e)).toBe(true)
  })

  it('un error de negocio conserva SU mensaje, no el del candado', async () => {
    espiarRed(() => json({ error: 'Pantalla fija: la unidad solo puede ser "mensual" o "catorcenal"' }, 400))
    const { actualizarModalidadesApi } = await import('@/lib/data/sitios-api')
    await expect(
      actualizarModalidadesApi('S1', { guardar: [{ unidad: 'spot', tarifaPublicada: 1 }] }),
    ).rejects.toThrow(/Pantalla fija/)
  })

  it('pega contra la ruta de modalidades y manda lo que se le dio', async () => {
    const llamadas = espiarRed(() => json({ ok: true }))
    const { actualizarModalidadesApi } = await import('@/lib/data/sitios-api')
    await actualizarModalidadesApi('S1', {
      guardar: [{ unidad: 'spot', tarifaPublicada: 250 }],
      quitar: ['hora'],
    })
    expect(llamadas).toHaveLength(1)
    expect(llamadas[0].url).toContain('/api/sitios/S1/modalidades/')
    expect(llamadas[0].cuerpo).toEqual({
      guardar: [{ unidad: 'spot', tarifaPublicada: 250 }],
      quitar: ['hora'],
    })
  })
})

// ─── 4 · la secuencia completa, contando peticiones ──────────────────────────
describe('4 · sin contraseña NO se cambia una tarifa por unidad', () => {
  async function guardarSpot() {
    const { actualizarModalidadesApi } = await import('@/lib/data/sitios-api')
    return () => actualizarModalidadesApi('S1', { guardar: [{ unidad: 'spot', tarifaPublicada: 250 }] })
  }

  it('el 403 abre el paso de la contraseña en vez de dar error', async () => {
    espiarRed(BLOQUEADO)
    const r = await confirmarConCandado({
      reautenticando: false,
      contrasena: '',
      desbloquear: async () => {},
      guardar: await guardarSpot(),
    })
    expect(r).toEqual({ estado: 'pedir-contrasena', error: null })
  })

  it('con el campo EN BLANCO no sale ni una petición más', async () => {
    const llamadas = espiarRed(BLOQUEADO)
    const r = await confirmarConCandado({
      reautenticando: true,
      contrasena: '',
      desbloquear: async () => {},
      guardar: await guardarSpot(),
    })
    expect(r).toEqual({ estado: 'falta-contrasena' })
    expect(llamadas).toEqual([])
  })

  it('con la contraseña EQUIVOCADA tampoco: el desbloqueo corta antes de guardar', async () => {
    const llamadas = espiarRed(BLOQUEADO)
    const r = await confirmarConCandado({
      reautenticando: true,
      contrasena: 'la-que-no-es',
      desbloquear: async () => {
        throw new Error('Contraseña incorrecta')
      },
      guardar: await guardarSpot(),
    })
    expect(r).toEqual({ estado: 'pedir-contrasena', error: 'Contraseña incorrecta' })
    expect(llamadas).toEqual([])
  })

  it('tras desbloquear se guarda, y el desbloqueo va PRIMERO', async () => {
    const orden: string[] = []
    globalThis.fetch = vi.fn(async (u: unknown) => {
      const url = String(u)
      if (url.includes('/api/estado')) return json({})
      orden.push('guardar')
      return json({ ok: true })
    }) as unknown as typeof fetch
    const r = await confirmarConCandado({
      reautenticando: true,
      contrasena: 'la-buena',
      desbloquear: async () => {
        orden.push('desbloquear')
      },
      guardar: await guardarSpot(),
    })
    expect(r).toEqual({ estado: 'hecho' })
    expect(orden).toEqual(['desbloquear', 'guardar'])
  })
})

// ─── 5 · la ficha ofrece DÓNDE teclearla ─────────────────────────────────────
describe('5 · el editor de modalidades de la ficha tiene campo de contraseña', () => {
  /**
   * El cuerpo de UN componente, acotado a propósito: que OTRO cuadro del mismo
   * archivo tenga campo no arregla éste — que es exactamente lo que pasaba el
   * 25/09 en `ContratoSheet.tsx`, con uno arreglado y dos rotos.
   *
   * El fin de línea se busca con `\r?\n`: en esta máquina `core.autocrlf=true`
   * deja el árbol en CRLF y un `lastIndexOf('\n}\n')` daría -1, con lo que la
   * prueba se caería por el sistema de archivos y no por el código.
   */
  function cuerpoDe(archivo: string, nombre: string): string {
    const desde = archivo.indexOf(`function ${nombre}(`)
    expect(desde, `${nombre} desapareció o se renombró`).toBeGreaterThan(-1)
    const trozo = archivo.slice(desde)
    const cierre = /\r?\n\}\r?\n/g
    const m = cierre.exec(trozo)
    expect(m, `no se encontró el cierre de ${nombre}`).not.toBeNull()
    return trozo.slice(0, (m as RegExpExecArray).index)
  }

  const EDITOR = cuerpoDe(FICHA, 'ModalidadesDialog')

  it('usa `useCandado`', () => {
    expect(EDITOR).toMatch(/useCandado\(\)/)
  })

  it('RINDE el paso de la contraseña — no solo lo importa', () => {
    // M6 del 25/09 sobrevivió a un `toContain('<DialogoCandado')` porque casaba
    // con la línea que lo DECLARA. Aquí se cuenta el elemento rendido dentro de
    // este componente, con su prop `candado`.
    expect(EDITOR.match(/<PasoContrasena\s+candado=\{candado\}/g) ?? []).toHaveLength(1)
  })

  it('el botón de confirmar REPITE lo pendiente en vez de rearmar el formulario', () => {
    // El usuario pudo tocar la lista mientras tecleaba la contraseña. Confirmar
    // tiene que aplicar lo que el servidor rechazó, no lo que haya ahora.
    expect(EDITOR).toMatch(/candado\.reautenticando\s*\?\s*\(\)\s*=>\s*void candado\.reintentar\(\)/)
  })

  it('no se puede confirmar con la contraseña en blanco', () => {
    expect(EDITOR).toMatch(/candado\.reautenticando\s*&&\s*!candado\.pass/)
  })

  it('guarda por la ruta de modalidades, no por el PATCH general', () => {
    expect(EDITOR).toMatch(/actualizarModalidadesApi\(/)
    expect(EDITOR).not.toMatch(/actualizarSitioApi\(/)
  })
})
