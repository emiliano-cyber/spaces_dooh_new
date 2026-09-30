import { describe, it, expect, vi, beforeEach } from 'vitest'

// El repo abre un pool de Postgres al importarse: se mockea porque estas
// pruebas solo ejercitan la VALIDACIÓN del controller. Mismo criterio que
// `ot-costo-controller.test.ts`.
const repo = {
  listarActivos: vi.fn(async (_f?: unknown) => []),
  listarMovimientos: vi.fn(async () => []),
  crearActivo: vi.fn(async (i: Record<string, unknown>) => ({ id: 'A1', estado: 'EN_ALMACEN', ...i })),
}
vi.mock('./almacen-repo', () => repo)

const { crearActivoCtrl, listarAlmacenCtrl } = await import('./almacen-controller')

beforeEach(() => vi.clearAllMocks())

const base = { etiqueta: 'INV-0001', descripcion: 'Camioneta de la cuadrilla norte' }

// ============================================================================
//  El alta de artículos del almacén por TIPO. Pedido del dueño 2026-09-30.
//
//  Hasta hoy la ruta validaba a mano y metía en `tipo_activo` CUALQUIER texto
//  que llegara: la lista de cuatro tipos vivía solo en el <select> de la
//  pantalla. Un `curl` se la saltaba. Estas pruebas fijan que el catálogo lo
//  aplica el servidor.
// ============================================================================

describe('control · el camino corriente llega al repo', () => {
  it('un alta con tipo del catálogo llega al repo', async () => {
    await crearActivoCtrl({ ...base, tipoActivo: 'VEHICULO' })
    expect(repo.crearActivo).toHaveBeenCalledWith(
      expect.objectContaining({ etiqueta: 'INV-0001', tipoActivo: 'VEHICULO' }),
    )
  })

  it('sin tipo sigue siendo PANTALLA, como antes del 30/09', async () => {
    await crearActivoCtrl(base)
    expect(repo.crearActivo).toHaveBeenCalledWith(expect.objectContaining({ tipoActivo: 'PANTALLA' }))
  })

  it('recorta espacios y convierte notas vacías en null', async () => {
    await crearActivoCtrl({ etiqueta: '  INV-2 ', descripcion: ' Taladro ', tipoActivo: 'HERRAMIENTA', notas: '   ' })
    expect(repo.crearActivo).toHaveBeenCalledWith(
      expect.objectContaining({ etiqueta: 'INV-2', descripcion: 'Taladro', notas: null }),
    )
  })
})

describe('NEGATIVO · lo que el servidor NO acepta aunque lo mande un curl', () => {
  it('un tipo fuera del catálogo se rechaza con 400', async () => {
    await expect(crearActivoCtrl({ ...base, tipoActivo: 'Pantalla LED' })).rejects.toMatchObject({ status: 400 })
    expect(repo.crearActivo).not.toHaveBeenCalled()
  })

  it('sin etiqueta o sin descripción se rechaza', async () => {
    await expect(crearActivoCtrl({ descripcion: 'x' })).rejects.toMatchObject({ status: 400 })
    await expect(crearActivoCtrl({ etiqueta: '   ', descripcion: 'x' })).rejects.toMatchObject({ status: 400 })
    await expect(crearActivoCtrl({ etiqueta: 'x' })).rejects.toMatchObject({ status: 400 })
    expect(repo.crearActivo).not.toHaveBeenCalled()
  })

  it('un campo de más —un tenantId— da 400 en vez de ignorarse', async () => {
    // El tenant sale SIEMPRE de la sesión. Aceptarlo en silencio haría creer a
    // quien lo manda que sirvió para algo.
    await expect(
      crearActivoCtrl({ ...base, tenantId: '00000000-0000-0000-0000-000000000000' }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('un texto desmedido se rechaza', async () => {
    await expect(crearActivoCtrl({ ...base, etiqueta: 'x'.repeat(121) })).rejects.toMatchObject({ status: 400 })
    await expect(crearActivoCtrl({ ...base, notas: 'x'.repeat(2001) })).rejects.toMatchObject({ status: 400 })
  })
})

describe('listado filtrado por tipo', () => {
  it('sin ?tipo lista todo', async () => {
    await listarAlmacenCtrl(new URLSearchParams())
    expect(repo.listarActivos).toHaveBeenCalledWith({ tipo: null })
  })

  it('con ?tipo=VEHICULO pasa el tipo al repo', async () => {
    await listarAlmacenCtrl(new URLSearchParams({ tipo: 'VEHICULO' }))
    expect(repo.listarActivos).toHaveBeenCalledWith({ tipo: 'VEHICULO' })
  })

  it('un ?tipo fuera del catálogo da 400, no una lista vacía', async () => {
    // Una lista vacía diría «no tienes camionetas» cuando lo que pasó es que
    // el filtro venía mal escrito.
    await expect(listarAlmacenCtrl(new URLSearchParams({ tipo: 'CAMIONETA' }))).rejects.toMatchObject({ status: 400 })
    expect(repo.listarActivos).not.toHaveBeenCalled()
  })
})
