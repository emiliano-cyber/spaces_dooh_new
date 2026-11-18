import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  VAL-07 · «Extender» acortaba, y una fecha que no era fecha daba 500.
// ----------------------------------------------------------------------------
//  `extenderCampanaCtrl` validaba `fechaFin` con `z.string().min(1)` — la misma
//  forma que UX-01 destapó en los contratos el 26/08— y `extenderCampana`
//  escribía sin mirar la fecha que ya tenía la campaña:
//
//      update campanas set fecha_fin=$2 where id=$1
//      update reservas  set fecha_fin=$2 where campana_id=$1
//
//  Dos consecuencias, y la segunda es la que importa:
//
//   1 · `fechaFin: 'mañana'` llegaba crudo a una columna `date` → error del
//       driver → 500. El usuario no se entera de qué escribió mal.
//   2 · una fecha ANTERIOR a la que ya tenía la campaña la ACORTA, y de paso
//       reescribe la fecha de fin de TODAS sus reservas y recalcula el
//       presupuesto. La acción se llama «extender», el usuario no está pidiendo
//       recortar nada, y el inventario que esas reservas ocupaban se libera sin
//       que nadie lo decida. Si además queda por debajo de `fecha_inicio`, la
//       campaña sale de todos los conteos que filtran por rango.
//
//  Se comprueba en las DOS capas a propósito: el controlador es quien puede
//  decir «eso no es una fecha» sin consultar nada, y el model es el único que
//  conoce la fecha EFECTIVA. Mismo reparto que UX-01.
// ============================================================================

// ─── 1) La forma de la entrada, en el controlador ───────────────────────────
const campanasRepo = {
  confirmarReserva: vi.fn(async () => ({ id: 'cmp-1' })),
  validarPublicacion: vi.fn(async () => ({ id: 'cmp-1' })),
  enviarADominio: vi.fn(async () => ({ id: 'cmp-1' })),
  extenderCampana: vi.fn(async (id: string, fechaFin: string) => ({ id, fechaFin })),
  extensionesCampana: vi.fn(async () => []),
  guardarContratoCampana: vi.fn(async () => ({ id: 'cmp-1' })),
  ValidacionError: class ValidacionError extends Error {},
}
vi.mock('./campanas-repo', () => campanasRepo)
vi.mock('./impresion-repo', () => ({ marcarOCRecibida: vi.fn(async () => null) }))

const { extenderCampanaCtrl } = await import('./campanas-controller')

beforeEach(() => vi.clearAllMocks())

// EXT-CONTRATO (29/10) · sin contrato no hay extensión. Un PDF mínimo de
// verdad (`%PDF-1.4`): el validador mira los bytes, no la etiqueta.
const PDF = 'data:application/pdf;base64,JVBERi0xLjQK'
const USUARIO = { id: 'u-1', nombre: 'Ana' }

async function extender(cuerpo: unknown) {
  try {
    await extenderCampanaCtrl('cmp-1', cuerpo, USUARIO)
    return { ok: true as const, mensaje: '', status: 200 }
  } catch (e) {
    const err = e as Error & { status?: number }
    return { ok: false as const, mensaje: err.message, status: err.status ?? 500 }
  }
}

describe('control · extender con una fecha de verdad sigue funcionando', () => {
  it('la fecha y el contrato llegan al model tal cual, con quién lo hizo', async () => {
    const r = await extender({ fechaFin: '2026-12-31', contratoUrl: PDF })
    expect(r.ok, r.mensaje).toBe(true)
    expect(campanasRepo.extenderCampana).toHaveBeenCalledWith('cmp-1', '2026-12-31', PDF, USUARIO)
  })
})

describe('VAL-07 · la fecha tiene que ser una fecha', () => {
  it('rechaza «mañana» con 400 y NO toca el model', async () => {
    const r = await extender({ fechaFin: 'mañana', contratoUrl: PDF })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
    expect(campanasRepo.extenderCampana).not.toHaveBeenCalled()
  })

  it('sigue exigiendo que venga', async () => {
    const r = await extender({})
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
  })
})

// ─── EXT-CONTRATO (29/10) · regla del dueño: no se extiende sin contrato ─────
//  Una extensión cambia la fecha fin y, con ella, lo que se factura (R4). El
//  dueño decidió el 29/10 que solo se hace con el contrato firmado de la
//  extensión adjunto EN EL MISMO PASO; sin él, el servidor la rechaza. Se exige
//  aquí y no solo en la pantalla: la API se puede llamar sin pasar por ella.
const MSG = 'Para extender la campaña adjunta el contrato firmado de la extensión'

describe('EXT-CONTRATO · sin contrato no se extiende', () => {
  it('NEGATIVO · sin contratoUrl: 422 con el mensaje, y el model NO se toca', async () => {
    const r = await extender({ fechaFin: '2026-12-31' })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(422)
    expect(r.mensaje).toBe(MSG)
    expect(campanasRepo.extenderCampana).not.toHaveBeenCalled()
  })

  it('NEGATIVO · contratoUrl vacío, en blanco o null cuenta como que no viene', async () => {
    for (const contratoUrl of ['', '   ', null]) {
      const r = await extender({ fechaFin: '2026-12-31', contratoUrl })
      expect(r.status, String(contratoUrl)).toBe(422)
      expect(r.mensaje).toBe(MSG)
    }
    expect(campanasRepo.extenderCampana).not.toHaveBeenCalled()
  })

  it('NEGATIVO · una imagen no pasa por contrato: solo PDF, como el del cliente', async () => {
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    const r = await extender({ fechaFin: '2026-12-31', contratoUrl: png })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(422)
    expect(campanasRepo.extenderCampana).not.toHaveBeenCalled()
  })

  it('el mensaje tiene su traducción (I18N-05)', async () => {
    const { traducirError } = await import('@/lib/i18n/errores-servidor')
    expect(traducirError(MSG, 'en')).not.toBe(MSG)
  })
})
