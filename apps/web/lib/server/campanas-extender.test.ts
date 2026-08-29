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
  guardarContratoCampana: vi.fn(async () => ({ id: 'cmp-1' })),
  ValidacionError: class ValidacionError extends Error {},
}
vi.mock('./campanas-repo', () => campanasRepo)
vi.mock('./impresion-repo', () => ({ marcarOCRecibida: vi.fn(async () => null) }))

const { extenderCampanaCtrl } = await import('./campanas-controller')

beforeEach(() => vi.clearAllMocks())

async function extender(cuerpo: unknown) {
  try {
    await extenderCampanaCtrl('cmp-1', cuerpo)
    return { ok: true as const, mensaje: '', status: 200 }
  } catch (e) {
    const err = e as Error & { status?: number }
    return { ok: false as const, mensaje: err.message, status: err.status ?? 500 }
  }
}

describe('control · extender con una fecha de verdad sigue funcionando', () => {
  it('la fecha llega al model tal cual', async () => {
    const r = await extender({ fechaFin: '2026-12-31' })
    expect(r.ok, r.mensaje).toBe(true)
    expect(campanasRepo.extenderCampana).toHaveBeenCalledWith('cmp-1', '2026-12-31')
  })
})

describe('VAL-07 · la fecha tiene que ser una fecha', () => {
  it('rechaza «mañana» con 400 y NO toca el model', async () => {
    const r = await extender({ fechaFin: 'mañana' })
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
