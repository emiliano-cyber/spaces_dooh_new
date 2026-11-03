import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { traducirError, PATRONES_ERROR, CATALOGO_ERRORES } from './errores-servidor'
import { DICCIONARIOS } from './diccionario'
import { DescuentoSobreTope, mensajeTopeVigente } from '../descuento'

// ============================================================================
//  OLA 6 · LOS DOS MENSAJES DEL FLUJO DE VENTA QUE SEGUIAN EN ESPANOL.
// ----------------------------------------------------------------------------
//  Los dejo la ola 4 (`docs/i18n/validacion-confirmaciones.md` §5):
//
//   1. El tope al EDITAR el descuento (`DescuentoSobreTope`, `lib/descuento.ts`).
//      El `PATCH /api/propuestas/[id]` lo responde a mano con `e.message`, sin
//      pasar por `respuestaError()`.
//   2. La negociacion con la agencia sin validar (`propuestas-repo.ts`), en dos
//      formas: al CREAR (va por `respuestaError()` como `AppError`) y al
//      APROBAR (el 400 generico del mismo `PATCH`, a mano).
//
//  El mismo mecanismo que la ola 4: patrones en `PATRONES_ERROR` y, donde la
//  ruta responde a mano, `traducirError(…, idiomaDeLaPeticion())`. En espanol
//  devuelve el mensaje intacto; el status no cambia.
// ============================================================================

const RAIZ = path.join(__dirname, '../..')
const leer = (f: string) => readFileSync(path.join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n')

const sobreTope = (pedido: number, tope: number, volumen = 0) => new DescuentoSobreTope(pedido, tope, volumen).message

// Las cifras de `pct()`: enteros o hasta dos decimales, en [0, 100].
const PEDIDOS = [0.01, 0.5, 5, 12.345, 20, 33.33, 99.99, 100]
const TOPES = [0, 0.01, 5, 8, 10, 12.5, 50, 99.5]
const VOLUMENES = [0, 0.004, 0.5, 10, 12.25, 50, 99, 100]
const RASTRO_ESPANOL = /descuento|tope|organizaci|Administraci|propuesta| %|Cabe|Pídele|volumen/

describe('el tope al EDITAR el descuento · las tres formas', () => {
  const casos: Array<[string, string, string]> = [
    [
      'sin volumen',
      sobreTope(30, 20),
      'The maximum discount your organization allows is 20%, and 30% was requested. The commercial discount can go up to 20%. ' +
        'Ask an admin to raise it in Settings if needed.',
    ],
    [
      'con volumen',
      sobreTope(12.5, 20, 10),
      'The maximum discount your organization allows is 20%. This proposal already has a 10% volume discount, so a 12.5% ' +
        'commercial discount leaves 21.25% in total (discounts compound, they don’t add up). The commercial discount can go ' +
        'up to 11.11%. Ask an admin to raise it in Settings if needed.',
    ],
    [
      'el volumen solo ya pasa el tope',
      sobreTope(5, 8, 10),
      'The volume discount (10%) is already over the cap (8%): leave the commercial discount at 0% or ask an admin to ' +
        'raise the cap in Settings.',
    ],
  ]
  for (const [nombre, es, en] of casos) {
    it(`${nombre}: el español idéntico y el inglés completo`, () => {
      expect(traducirError(es, 'es')).toBe(es)
      expect(traducirError(es, 'en')).toBe(en)
    })
  }

  it('las 512 combinaciones: español idéntico, inglés sin rastro de español', () => {
    let n = 0
    for (const p of PEDIDOS)
      for (const t of TOPES)
        for (const v of VOLUMENES) {
          const es = sobreTope(p, t, v)
          expect(traducirError(es, 'es')).toBe(es)
          const en = traducirError(es, 'en')
          expect(en, es).not.toMatch(RASTRO_ESPANOL)
          n++
        }
    expect(n).toBe(512)
  })

  it('al APROBAR sigue saliendo la frase de la ola 4 (no la pisa un patron nuevo)', () => {
    const e = new DescuentoSobreTope(20, 10, 0)
    expect(traducirError(mensajeTopeVigente(e), 'en')).toMatch(/^The discount on this proposal, 20%, is over/)
  })
})

describe('la negociacion con la agencia sin validar', () => {
  const casos: Array<[string, string, string]> = [
    [
      'al crear',
      'La negociación con la agencia Agencia Uno no está validada; valídala antes de crear la propuesta',
      'The negotiation with the agency Agencia Uno is not validated; validate it before creating the proposal',
    ],
    [
      'al aprobar',
      'La negociación con la agencia Agencia Uno no está validada; no se puede aprobar la propuesta',
      'The negotiation with the agency Agencia Uno is not validated; the proposal can’t be approved',
    ],
    [
      'sin nombre de agencia (el servidor escribe `?? \'\'`)',
      'La negociación con la agencia  no está validada; no se puede aprobar la propuesta',
      'The negotiation with the agency  is not validated; the proposal can’t be approved',
    ],
  ]
  for (const [nombre, es, en] of casos) {
    it(`${nombre}: el español idéntico y el inglés completo`, () => {
      expect(traducirError(es, 'es')).toBe(es)
      expect(traducirError(es, 'en')).toBe(en)
    })
  }

  it('las dos frases son las del servidor, letra por letra', () => {
    const s = leer('lib/server/propuestas-repo.ts')
    expect(s).toContain(
      "`La negociación con la agencia ${bloq.nombre ?? ''} no está validada; valídala antes de crear la propuesta`",
    )
    expect(s).toContain(
      "`La negociación con la agencia ${bloq.nombre ?? ''} no está validada; no se puede aprobar la propuesta`",
    )
  })
})

describe('los patrones nuevos no casan con ningun otro texto conocido', () => {
  it('ni con el catalogo de errores ni con el diccionario', () => {
    const nuevos = PATRONES_ERROR.filter((p) =>
      /^\^(El descuento máximo que autoriza|El descuento por volumen \\\(|La negociación con la agencia)/.test(p.re.source),
    )
    expect(nuevos.length).toBe(5)
    const textos = [
      ...Object.keys(CATALOGO_ERRORES),
      ...Object.values(DICCIONARIOS.es as Record<string, string>),
      ...Object.values(DICCIONARIOS.en as Record<string, string>),
    ]
    for (const p of nuevos) expect(textos.filter((t) => p.re.test(t)), p.re.source).toEqual([])
  })
})

// ─── La ruta: el mismo status, la frase en el idioma de la peticion ─────────

const idioma = vi.hoisted(() => ({ actual: 'es' as 'es' | 'en' }))
const repo = vi.hoisted(() => {
  class PropuestaError extends Error {}
  class PropuestaCeroError extends PropuestaError {}
  class CodigoPendienteError extends PropuestaError {}
  class TopeVigenteError extends PropuestaError {}
  return {
    PropuestaError,
    PropuestaCeroError,
    CodigoPendienteError,
    TopeVigenteError,
    cambiarEstatusPropuesta: vi.fn(),
    actualizarPropuesta: vi.fn(),
    borrarPropuestaBorrador: vi.fn(),
  }
})

vi.mock('@/lib/server/auth', () => ({ exigir: async () => ({ ok: true, usuario: { id: 'u1' } }) }))
vi.mock('@/lib/server/propuestas-repo', () => repo)
vi.mock('@/lib/server/campanas-repo', () => ({
  generarCampanaDesdePropuesta: vi.fn(),
  PropuestaCampanaError: class extends Error {},
}))
vi.mock('@/lib/server/acciones-repo', () => ({ registrarAccion: vi.fn() }))
vi.mock('@/lib/server/notificaciones-repo', () => ({ notificar: vi.fn() }))
vi.mock('@/lib/server/moneda-instancia', () => ({ monedaDeLaInstancia: vi.fn() }))
vi.mock('@/lib/i18n/servidor', () => ({ idiomaDeLaPeticion: () => idioma.actual }))

describe('PATCH /api/propuestas/[id]', () => {
  beforeEach(() => {
    repo.cambiarEstatusPropuesta.mockReset()
    repo.actualizarPropuesta.mockReset()
    idioma.actual = 'es'
  })
  afterEach(() => {
    idioma.actual = 'es'
  })

  async function patch(cuerpo: Record<string, unknown>) {
    const { PATCH } = await import('@/app/api/propuestas/[id]/route')
    const r = await PATCH(
      new Request('http://x/api/propuestas/p1', { method: 'PATCH', body: JSON.stringify(cuerpo) }),
      { params: { id: 'p1' } },
    )
    return { status: r.status, cuerpo: await r.json() }
  }

  const TOPE_ES = sobreTope(30, 20)
  const AGENCIA_ES = 'La negociación con la agencia Agencia Uno no está validada; no se puede aprobar la propuesta'

  it('editar sobre el tope, en español: el 400 y la frase de siempre', async () => {
    repo.actualizarPropuesta.mockRejectedValue(new DescuentoSobreTope(30, 20, 0))
    expect(await patch({ descuentoPct: 30 })).toEqual({ status: 400, cuerpo: { error: TOPE_ES } })
  })

  it('editar sobre el tope, en inglés: el mismo 400 con la frase en inglés', async () => {
    idioma.actual = 'en'
    repo.actualizarPropuesta.mockRejectedValue(new DescuentoSobreTope(30, 20, 0))
    const r = await patch({ descuentoPct: 30 })
    expect(r.status).toBe(400)
    expect(r.cuerpo.error).toBe(traducirError(TOPE_ES, 'en'))
    expect(r.cuerpo.error).toMatch(/^The maximum discount your organization allows is 20%/)
  })

  it('editar con un error de dominio sigue en 409, y también se traduce', async () => {
    idioma.actual = 'en'
    repo.actualizarPropuesta.mockRejectedValue(
      new repo.PropuestaError('La propuesta ya está aprobada y es inmutable; un cambio va como adenda'),
    )
    const r = await patch({ nombre: 'x' })
    expect(r.status).toBe(409)
    expect(r.cuerpo.error).toBe(
      traducirError('La propuesta ya está aprobada y es inmutable; un cambio va como adenda', 'en'),
    )
  })

  it('aprobar con la agencia sin validar, en español: el 400 de siempre', async () => {
    repo.cambiarEstatusPropuesta.mockRejectedValue(new repo.PropuestaError(AGENCIA_ES))
    expect(await patch({ estatus: 'APROBADA' })).toEqual({ status: 400, cuerpo: { error: AGENCIA_ES } })
  })

  it('aprobar con la agencia sin validar, en inglés: el mismo 400, en inglés', async () => {
    idioma.actual = 'en'
    repo.cambiarEstatusPropuesta.mockRejectedValue(new repo.PropuestaError(AGENCIA_ES))
    expect(await patch({ estatus: 'APROBADA' })).toEqual({
      status: 400,
      cuerpo: { error: 'The negotiation with the agency Agencia Uno is not validated; the proposal can’t be approved' },
    })
  })

  it('el respaldo sin mensaje tampoco cambia en español', async () => {
    repo.cambiarEstatusPropuesta.mockRejectedValue('no es un Error')
    expect(await patch({ estatus: 'APROBADA' })).toEqual({ status: 400, cuerpo: { error: 'No se pudo actualizar' } })
  })
})
