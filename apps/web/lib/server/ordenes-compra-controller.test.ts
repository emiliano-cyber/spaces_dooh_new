import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  VAL-06 · la orden de compra del cliente entraba SIN VALIDAR NADA.
// ----------------------------------------------------------------------------
//  `app/api/ordenes-compra/route.ts` era la única ruta de DINERO sin capa de
//  controlador: comprobaba que viniera `campanaId` y le pasaba al model
//  `monto`, `fecha`, `numeroOc`, `documentoUrl` y `notas` tal como llegaron por
//  HTTP. Con eso:
//
//   · `monto: -50000` se guardaba. `ordenes_compra.monto` es
//     `numeric(14,2)` sin CHECK (`db/schema.sql:416`), así que la base tampoco
//     lo frena.
//   · `monto: 'abc'` reventaba en el driver → 500.
//   · `fecha: 'mañana'` llegaba a `coalesce($5::date, current_date)` → 500.
//     Es el mismo defecto que UX-01, en otra ruta.
//   · `numeroOc` y `notas` sin tope.
//
//  Y lo que lo pone por delante de todo lo demás del barrido: **una ODC no se
//  puede corregir ni borrar desde la aplicación**. No hay PATCH ni DELETE en
//  `/api/ordenes-compra`. Además registrarla pone `oc_recibida = true` y puede
//  pasar la campaña a `LISTA_FACTURAR`, así que el importe equivocado se queda
//  y encima abre el candado de facturación.
// ============================================================================

const repo = {
  crearOrdenCompra: vi.fn(async (campanaId: string, input: unknown) => ({
    id: 'odc-1',
    folio: 'ODC-2026-0001',
    campanaId,
    monto: 1000,
    ...(input as object),
  })),
}
vi.mock('./ordenes-compra-repo', () => repo)

const { crearOrdenCompraCtrl } = await import('./ordenes-compra-controller')

beforeEach(() => vi.clearAllMocks())

async function alta(cuerpo: unknown) {
  try {
    const odc = await crearOrdenCompraCtrl(cuerpo)
    return { ok: true as const, odc, mensaje: '', status: 201 }
  } catch (e) {
    const err = e as Error & { status?: number }
    return { ok: false as const, odc: null, mensaje: err.message, status: err.status ?? 500 }
  }
}

// Sin este control, cualquier rotura del módulo haría pasar los negativos por
// el motivo equivocado — el fallo que se repitió cinco veces el 26/08.
describe('control · la ODC corriente sigue entrando', () => {
  it('una ODC normal llega al model', async () => {
    const r = await alta({ campanaId: 'cmp-1', monto: 125000.5, numeroOc: 'OC-9912', fecha: '2026-08-26' })
    expect(r.ok, r.mensaje).toBe(true)
    expect(repo.crearOrdenCompra).toHaveBeenCalledTimes(1)
    expect(repo.crearOrdenCompra.mock.calls[0][0]).toBe('cmp-1')
    expect(repo.crearOrdenCompra.mock.calls[0][1]).toMatchObject({ monto: 125000.5, numeroOc: 'OC-9912' })
  })

  it('sin monto sigue valiendo: el model lo saca del presupuesto de la campaña', async () => {
    const r = await alta({ campanaId: 'cmp-1' })
    expect(r.ok, r.mensaje).toBe(true)
    expect(repo.crearOrdenCompra.mock.calls[0][1]).toMatchObject({ monto: null })
  })
})

describe('VAL-06 · el importe', () => {
  it('rechaza un monto negativo y NO escribe', async () => {
    const r = await alta({ campanaId: 'cmp-1', monto: -50000 })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
    expect(repo.crearOrdenCompra).not.toHaveBeenCalled()
  })

  it('rechaza un monto que no es un número', async () => {
    const r = await alta({ campanaId: 'cmp-1', monto: 'abc' })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
    expect(repo.crearOrdenCompra).not.toHaveBeenCalled()
  })

  it('rechaza un monto que no cabe en numeric(14,2) antes de que reviente el driver', async () => {
    const r = await alta({ campanaId: 'cmp-1', monto: 1e15 })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
    expect(repo.crearOrdenCompra).not.toHaveBeenCalled()
  })

  it('el cero SÍ vale: una ODC de cortesía existe y el model ya usaba 0 por defecto', async () => {
    const r = await alta({ campanaId: 'cmp-1', monto: 0 })
    expect(r.ok, r.mensaje).toBe(true)
  })
})

describe('VAL-06 · la fecha', () => {
  it('rechaza una fecha que no es fecha, en vez de dejar que reviente $5::date', async () => {
    const r = await alta({ campanaId: 'cmp-1', fecha: 'mañana' })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
    expect(repo.crearOrdenCompra).not.toHaveBeenCalled()
  })
})

describe('VAL-06 · los textos', () => {
  it('rechaza un número de OC descomunal', async () => {
    const r = await alta({ campanaId: 'cmp-1', numeroOc: 'X'.repeat(5000) })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
    expect(repo.crearOrdenCompra).not.toHaveBeenCalled()
  })

  it('rechaza notas descomunales', async () => {
    const r = await alta({ campanaId: 'cmp-1', notas: 'X'.repeat(5000) })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
  })
})

describe('VAL-06 · la campaña', () => {
  it('sin campaña sigue siendo 400', async () => {
    const r = await alta({})
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
  })

  it('el model contesta que la campaña no existe → 404, no 500', async () => {
    repo.crearOrdenCompra.mockResolvedValueOnce(null as never)
    const r = await alta({ campanaId: '00000000-0000-0000-0000-000000000000' })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(404)
  })
})

// ─── El documento: un tope de largo a secas ROMPE el flujo real ─────────────
//  Encontrado al revisar quién llama a esta ruta. `CandadoPanel.tsx:55` manda
//  `documentoUrl: camp.contratoUrl`, y `contrato_url` NO es siempre una URL: la
//  campaña lo guarda con `uploadOUrlZod(LIMITES.contratoPdf…)`
//  (`campanas-controller.ts:78`), así que puede ser un `data:` URL de varios
//  MB con el PDF del contrato dentro.
//
//  Un `.max(2000)` sobre ese campo habría dejado de registrar la ODC de toda
//  campaña con contrato subido — un arreglo de validación que rompe el camino
//  que sí funcionaba. Se usa la MISMA regla que usa la campaña para el mismo
//  documento, no una inventada aquí.
describe('VAL-06 · el documento adjunto usa la regla del contrato de campaña', () => {
  const pdfChico = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4 hola').toString('base64')

  it('un PDF en data URL entra, aunque pase de 2 000 caracteres', async () => {
    const relleno = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4 ' + 'a'.repeat(4000)).toString('base64')
    expect(relleno.length).toBeGreaterThan(2000)
    const r = await alta({ campanaId: 'cmp-1', documentoUrl: relleno })
    expect(r.ok, r.mensaje).toBe(true)
  })

  it('una liga normal sigue entrando', async () => {
    const r = await alta({ campanaId: 'cmp-1', documentoUrl: 'https://ejemplo.mx/oc/9912.pdf' })
    expect(r.ok, r.mensaje).toBe(true)
  })

  it('rechaza un data URL que no es un tipo permitido', async () => {
    const r = await alta({ campanaId: 'cmp-1', documentoUrl: 'data:text/html;base64,' + Buffer.from('<script>').toString('base64') })
    expect(r.ok).toBe(false)
    expect(repo.crearOrdenCompra).not.toHaveBeenCalled()
  })

  it('control: el PDF chico de siempre pasa', async () => {
    const r = await alta({ campanaId: 'cmp-1', documentoUrl: pdfChico })
    expect(r.ok, r.mensaje).toBe(true)
  })
})
