import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { traducir } from './diccionario'
import { traducirError } from './errores-servidor'
import { formatearDineroRedondo } from './dinero'
import { DescuentoSobreTope, mensajeTopeVigente } from '../descuento'

// ============================================================================
//  LAS CONFIRMACIONES DE APROBAR UNA PROPUESTA, EN EL IDIOMA DE QUIEN APRUEBA.
// ----------------------------------------------------------------------------
//  Lo dejo pendiente el validador del lote servidor (2026-11-02): la ruta
//  `PATCH /api/propuestas/[id]` responde a mano `{ error: e.message, … }` en
//  dos 409 del flujo de aprobar, sin pasar por `respuestaError()`, que es el
//  embudo que traduce. Con la pantalla en ingles salia una pregunta en español
//  con el boton en ingles.
//
//    · aprobar en $0 (`requiereConfirmacionCero`): el `window.confirm`. Ya
//      traia bandera y clase en el cliente (`ConfirmacionCeroError`): la
//      pantalla pinta su propia clave, como el cupon pendiente.
//    · el descuento sobre el tope VIGENTE (`descuentoSobreTope`): el toast.
//      Lleva cuatro cifras que solo tiene el servidor, asi que esa frase la
//      rearma `traducirError` en la ruta (patrones de `errores-servidor.ts`).
//
//  Lo que NO puede cambiar: el español letra por letra, el status 409, la
//  bandera y lo que pasa al confirmar.
// ============================================================================

const RAIZ = path.join(__dirname, '../..')
const leer = (archivo: string) => readFileSync(path.join(RAIZ, archivo), 'utf8').replace(/\r\n/g, '\n')

const MSJ_CERO_ES = 'Estás por aprobar una propuesta con Total $0. Confirma explícitamente para continuar.'

describe('aprobar en $0 · la pantalla pinta su clave', () => {
  it('el español de la clave es el del servidor, letra por letra', () => {
    // El servidor sigue lanzando su literal (nadie lo toco).
    expect(leer('lib/server/propuestas-repo.ts')).toContain(`new PropuestaCeroError('${MSJ_CERO_ES}')`)
    expect(
      traducir('es', 'servidor.propuesta.aprobar-en-cero', { total: formatearDineroRedondo(0, 'es') }),
    ).toBe(MSJ_CERO_ES)
  })

  it('y el confirm entero en español es el de antes', () => {
    const antes = `${MSJ_CERO_ES}\n\n${traducir('es', 'propuestas.comun.aprobar-igual')}`
    const ahora =
      `${traducir('es', 'servidor.propuesta.aprobar-en-cero', { total: formatearDineroRedondo(0, 'es') })}` +
      `\n\n${traducir('es', 'propuestas.comun.aprobar-igual')}`
    expect(ahora).toBe(antes)
  })

  it('en ingles sale en ingles, con MX$ y sin cifras en el diccionario', () => {
    expect(
      traducir('en', 'servidor.propuesta.aprobar-en-cero', { total: formatearDineroRedondo(0, 'en') }),
    ).toBe('You are about to approve a proposal with a total of MX$0. Confirm explicitly to continue.')
    expect(traducir('en', 'servidor.propuesta.aprobar-en-cero')).not.toMatch(/\d|\$/)
    expect(traducir('es', 'servidor.propuesta.aprobar-en-cero')).not.toMatch(/\d|\$/)
  })

  it('las dos pantallas de propuestas usan la clave en el confirm, y confirmar sigue reintentando con confirmarCero', () => {
    for (const archivo of ['app/(app)/(shell)/propuestas/page.tsx', 'app/(app)/(shell)/propuestas/[id]/page.tsx']) {
      const src = leer(archivo)
      expect(src, archivo).toContain(
        "window.confirm(`${t('servidor.propuesta.aprobar-en-cero', { total: formatearDineroRedondo(0, idioma) })}\\n\\n${t('propuestas.comun.aprobar-igual')}`)) return cambiar(estatus, true)",
      )
      expect(src, archivo).not.toContain('window.confirm(`${e.message}')
    }
  })

  it('el cliente sigue reconociendo la bandera y conserva el texto del servidor', async () => {
    const { cambiarEstatusPropuestaApi, ConfirmacionCeroError } = await import('../data/estado-api')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 409, json: async () => ({ error: MSJ_CERO_ES, requiereConfirmacionCero: true }) }) as unknown as Response),
    )
    const e = await cambiarEstatusPropuestaApi('p1', 'APROBADA').catch((x) => x)
    expect(e).toBeInstanceOf(ConfirmacionCeroError)
    expect(e.message).toBe(MSJ_CERO_ES)
    vi.unstubAllGlobals()
  })
})

describe('el descuento sobre el tope vigente · la frase la rearma traducirError', () => {
  // Las tres formas que `mensajeTopeVigente` puede armar. La cuarta (sin
  // volumen y con «el volumen solo ya pasa el tope») es inalcanzable: si el
  // volumen pasa el tope, el volumen es mayor que 0 y la cabecera lo nombra.
  const casos: Array<[string, DescuentoSobreTope, string]> = [
    [
      'sin volumen',
      new DescuentoSobreTope(20, 10, 0),
      'The discount on this proposal, 20%, is over your organization’s current discount cap, 10%: the cap was ' +
        'lowered after it was saved. Adjust the discount before approving it (the commercial discount can go up ' +
        'to 10%), or ask an admin to raise the cap in Settings.',
    ],
    [
      'con volumen',
      new DescuentoSobreTope(12.5, 20, 10),
      'The discount on this proposal, 12.5% (21.25% in total with the 10% volume discount), is over your ' +
        'organization’s current discount cap, 20%: the cap was lowered after it was saved. Adjust the discount ' +
        'before approving it (the commercial discount can go up to 11.11%), or ask an admin to raise the cap in Settings.',
    ],
    [
      'el volumen solo ya pasa el tope',
      new DescuentoSobreTope(5, 8, 10),
      'The discount on this proposal, 5% (14.5% in total with the 10% volume discount), is over your ' +
        'organization’s current discount cap, 8%: the cap was lowered after it was saved. The volume discount ' +
        '(10%) is already over the cap (8%): leave the commercial discount at 0% or ask an admin to raise the cap in Settings.',
    ],
  ]

  for (const [nombre, e, en] of casos) {
    it(`${nombre}: el español sale identico y el ingles completo`, () => {
      const es = mensajeTopeVigente(e)
      expect(traducirError(es, 'es')).toBe(es)
      expect(traducirError(es, 'en')).toBe(en)
    })
  }
})

// ─── La ruta: mismo status, misma bandera, mismo comportamiento ─────────────

const idioma = vi.hoisted(() => ({ actual: 'es' as 'es' | 'en' }))
const repo = vi.hoisted(() => {
  class PropuestaError extends Error {}
  class PropuestaCeroError extends PropuestaError {}
  class CodigoPendienteError extends PropuestaError {}
  class TopeVigenteError extends PropuestaError {
    detalle: unknown
    constructor(m: string, d: unknown) {
      super(m)
      this.detalle = d
    }
  }
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

describe('PATCH /api/propuestas/[id] al aprobar', () => {
  beforeEach(() => {
    repo.cambiarEstatusPropuesta.mockReset()
    idioma.actual = 'es'
  })
  afterEach(() => {
    idioma.actual = 'es'
  })

  async function aprobar(confirmarCero?: boolean) {
    const { PATCH } = await import('@/app/api/propuestas/[id]/route')
    const r = await PATCH(
      new Request('http://x/api/propuestas/p1', {
        method: 'PATCH',
        body: JSON.stringify({ estatus: 'APROBADA', confirmarCero }),
      }),
      { params: { id: 'p1' } },
    )
    return { status: r.status, cuerpo: await r.json() }
  }

  const tope = () => {
    const d = new DescuentoSobreTope(20, 10, 0)
    return new repo.TopeVigenteError(mensajeTopeVigente(d), d)
  }

  it('tope en español: 409, la bandera y la frase de siempre', async () => {
    repo.cambiarEstatusPropuesta.mockRejectedValue(tope())
    expect(await aprobar()).toEqual({
      status: 409,
      cuerpo: { error: mensajeTopeVigente(new DescuentoSobreTope(20, 10, 0)), descuentoSobreTope: true },
    })
  })

  it('tope en ingles: el mismo 409 y la misma bandera, con la frase en ingles', async () => {
    idioma.actual = 'en'
    repo.cambiarEstatusPropuesta.mockRejectedValue(tope())
    const r = await aprobar()
    expect(r.status).toBe(409)
    expect(r.cuerpo.descuentoSobreTope).toBe(true)
    expect(r.cuerpo.error).toBe(casosEn.sinVolumen)
  })

  it('$0: el mismo 409 con su bandera, en los dos idiomas (la pantalla pinta su clave)', async () => {
    for (const i of ['es', 'en'] as const) {
      idioma.actual = i
      repo.cambiarEstatusPropuesta.mockRejectedValue(new repo.PropuestaCeroError(MSJ_CERO_ES))
      expect(await aprobar()).toEqual({ status: 409, cuerpo: { error: MSJ_CERO_ES, requiereConfirmacionCero: true } })
    }
  })

  it('confirmar en $0 sigue llegando al repo con confirmarCero', async () => {
    repo.cambiarEstatusPropuesta.mockResolvedValue(null)
    expect((await aprobar(true)).status).toBe(404)
    expect(repo.cambiarEstatusPropuesta).toHaveBeenCalledWith('p1', 'APROBADA', { confirmarCero: true })
  })
})

const casosEn = {
  sinVolumen:
    'The discount on this proposal, 20%, is over your organization’s current discount cap, 10%: the cap was ' +
    'lowered after it was saved. Adjust the discount before approving it (the commercial discount can go up ' +
    'to 10%), or ask an admin to raise the cap in Settings.',
}
