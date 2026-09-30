import { describe, it, expect, vi, beforeEach } from 'vitest'

// El repo abre un pool de Postgres al importarse: se mockea porque estas
// pruebas solo ejercitan la VALIDACIÓN del controller. Mismo criterio que
// `ot-costo-controller.test.ts`.
const repo = {
  crearOT: vi.fn(),
  fijarCostoOT: vi.fn(),
  marcarPuntoChecklist: vi.fn(async (id: string, p: unknown) => ({ id, ...(p as object) })),
}
vi.mock('./ot-repo', () => repo)

const { marcarPuntoChecklistCtrl } = await import('./ot-controller')

beforeEach(() => vi.clearAllMocks())

// ============================================================================
//  OT-CHECK-01 · la validación de «marcar un punto del checklist».
// ----------------------------------------------------------------------------
//  La pantalla manda { indice, label, hecho }. El `label` no es decoración: es
//  lo que impide que un índice VIEJO marque el punto equivocado si el checklist
//  de la OT cambió entre que se abrió la pantalla y se tachó.
//
//  Y `hecho` es booleano ESTRICTO: sin coerción, un `'false'` en texto sería
//  verdadero en JavaScript y marcaría lo que el usuario quiso desmarcar.
// ============================================================================

describe('control · el camino corriente llega al repo', () => {
  it('marcar un punto llega tal cual', async () => {
    await marcarPuntoChecklistCtrl('OT1', { indice: 2, label: 'Montaje', hecho: true })
    expect(repo.marcarPuntoChecklist).toHaveBeenCalledWith('OT1', { indice: 2, label: 'Montaje', hecho: true })
  })

  it('desmarcar también', async () => {
    await marcarPuntoChecklistCtrl('OT1', { indice: 0, label: 'Montaje', hecho: false })
    expect(repo.marcarPuntoChecklist).toHaveBeenCalledWith('OT1', { indice: 0, label: 'Montaje', hecho: false })
  })
})

describe('NEGATIVO · lo que se rechaza con 400 sin tocar la base', () => {
  const casos: [string, unknown][] = [
    ['sin cuerpo', undefined],
    ['sin indice', { label: 'x', hecho: true }],
    ['indice negativo', { indice: -1, label: 'x', hecho: true }],
    ['indice decimal', { indice: 1.5, label: 'x', hecho: true }],
    ['indice en texto', { indice: '1', label: 'x', hecho: true }],
    ['sin label', { indice: 0, hecho: true }],
    ['label vacío', { indice: 0, label: '', hecho: true }],
    ['hecho en texto', { indice: 0, label: 'x', hecho: 'false' }],
    ['hecho numérico', { indice: 0, label: 'x', hecho: 1 }],
    ['sin hecho', { indice: 0, label: 'x' }],
  ]
  for (const [nombre, cuerpo] of casos) {
    it(nombre, async () => {
      await expect(marcarPuntoChecklistCtrl('OT1', cuerpo)).rejects.toMatchObject({ status: 400 })
      expect(repo.marcarPuntoChecklist).not.toHaveBeenCalled()
    })
  }
})
