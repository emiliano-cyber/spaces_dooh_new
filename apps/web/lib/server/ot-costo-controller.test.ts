import { describe, it, expect, vi, beforeEach } from 'vitest'

// El repo abre un pool de Postgres al importarse: se mockea porque estas
// pruebas solo ejercitan la VALIDACIÓN del controller. Mismo criterio que
// `clientes-controller.test.ts` y `arrendadores-controller.test.ts`.
const repo = {
  crearOT: vi.fn(async (i: unknown) => ({ id: 'OT1', ...(i as object) })),
  fijarCostoOT: vi.fn(async (id: string, costo: number | null) => ({
    id,
    folio: 'OT-2026-0001',
    costoReal: costo,
  })),
}
vi.mock('./ot-repo', () => repo)

const { fijarCostoOTCtrl } = await import('./ot-controller')

beforeEach(() => vi.clearAllMocks())

// ============================================================================
//  OT-COSTO-01 · la validación del costo real de una orden de trabajo.
// ----------------------------------------------------------------------------
//  Esto es DINERO que entra directo al costo de operación del reporte de
//  rentabilidad, restando del margen. La UI ya valida, pero un `curl` se salta
//  la UI entera — que es el hallazgo que este repositorio ya pagó con el alta
//  de clientes (`clientes-controller.test.ts`).
//
//  El caso que más importa es el NEGATIVO: un costo negativo no da error en
//  ninguna capa y SUBE el margen, porque entra restando. Un número que mejora
//  las cifras sin que nadie lo note es justo el fallo que nadie reporta.
// ============================================================================

describe('control · el camino corriente llega al repo', () => {
  // Sin este caso, cualquier rotura del módulo (un import mal, una firma
  // cambiada) haría pasar los casos negativos por el motivo equivocado.
  it('un costo normal llega al repo tal cual', async () => {
    await fijarCostoOTCtrl('OT1', { costoReal: 12000 })
    expect(repo.fijarCostoOT).toHaveBeenCalledWith('OT1', 12000)
  })

  it('CERO es un costo válido y llega como 0, no como null', async () => {
    // Una inspección que hace el propio dueño no paga cuadrilla. Si el 0 se
    // tratara como «sin capturar», esa visita volvería a la estimación por tipo
    // y el reporte le cobraría 1 500 a algo que costó nada. Mismo criterio que
    // `importeValido()` en `lib/costos-ot.ts`.
    await fijarCostoOTCtrl('OT1', { costoReal: 0 })
    expect(repo.fijarCostoOT).toHaveBeenCalledWith('OT1', 0)
  })

  it('`null` BORRA el costo capturado y vuelve a la estimación', async () => {
    // Hace falta poder deshacer: quien teclea 120000 en vez de 12000 tiene que
    // poder dejar la OT como estaba, y «como estaba» es sin costo real, no con
    // un cero —que afirmaría que la visita fue gratis—.
    await fijarCostoOTCtrl('OT1', { costoReal: null })
    expect(repo.fijarCostoOT).toHaveBeenCalledWith('OT1', null)
  })
})

describe('NEGATIVO · lo que el servidor NO acepta aunque la UI lo mande', () => {
  it('un costo NEGATIVO se rechaza', async () => {
    // El peor de todos: entra restando en el margen, así que un negativo lo
    // SUBE. No da error en ninguna capa y mejora las cifras.
    await expect(fijarCostoOTCtrl('OT1', { costoReal: -500 })).rejects.toThrow()
    expect(repo.fijarCostoOT).not.toHaveBeenCalled()
  })

  it('un texto se rechaza, no se convierte a número', async () => {
    await expect(fijarCostoOTCtrl('OT1', { costoReal: '12000' })).rejects.toThrow()
    expect(repo.fijarCostoOT).not.toHaveBeenCalled()
  })

  it('NaN e Infinity se rechazan', async () => {
    await expect(fijarCostoOTCtrl('OT1', { costoReal: Number.NaN })).rejects.toThrow()
    await expect(fijarCostoOTCtrl('OT1', { costoReal: Number.POSITIVE_INFINITY })).rejects.toThrow()
    expect(repo.fijarCostoOT).not.toHaveBeenCalled()
  })

  it('un cuerpo sin `costoReal` se rechaza — no se confunde con borrarlo', async () => {
    // `undefined` y `null` NO son lo mismo aquí: `null` es «bórralo», y un
    // cuerpo vacío es una petición mal armada. Tratarlos igual haría que un
    // error de la pantalla borrara un costo capturado sin decir nada.
    await expect(fijarCostoOTCtrl('OT1', {})).rejects.toThrow()
    expect(repo.fijarCostoOT).not.toHaveBeenCalled()
  })
})
