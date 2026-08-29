import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  Contrato: el PREDIO es obligatorio (Fase 1.6/1.7).
//  El P&L atribuye la renta por predio (derive.ts ignora los contratos con
//  predio_id NULL), así que un contrato sin predio no costaría nada e inflaría
//  el margen por el monto completo de la renta. La validación debe rechazarlo
//  ANTES de llegar a la BD.
// ============================================================================

// El repo abre un pool de Postgres al importarse: se mockea porque estas
// pruebas solo ejercitan la validación del controller.
const repo = {
  crearContratoConSitio: vi.fn(async (i: unknown) => i),
  agregarPantallaAPredio: vi.fn(async (predioId: string, sitio: unknown) => ({ predioId, sitio })),
  iniciarRenovacion: vi.fn(async () => ({ contrato: { id: 'C1' } })),
  registrarPagoRenta: vi.fn(async () => ({ pago: { id: 'P1' } })),
  adjuntarAPago: vi.fn(async (id: string, d: unknown) => ({ id, ...(d as object) })),
  obtenerAdjuntoPago: vi.fn(async () => 'data:application/pdf;base64,AAAA'),
  crearPredio: vi.fn(), editarPredio: vi.fn(), crearArrendador: vi.fn(),
  editarArrendador: vi.fn(), borrarArrendador: vi.fn(), editarContrato: vi.fn(),
  cancelarContrato: vi.fn(), crearRazonSocial: vi.fn(),
  crearLicencia: vi.fn(async (d: unknown) => ({ id: 'L1', ...(d as object) })),
  editarLicencia: vi.fn(), borrarLicencia: vi.fn(), listarLicencias: vi.fn(),
}
vi.mock('./arrendadores-repo', () => repo)

// El controller también dispara las OT de montaje/retiro. Ese módulo arrastra
// ot-repo → tenant.ts, que llama a `cache()` de React en el cuerpo del módulo:
// fuera de Next eso es `cache is not a function` y el archivo entero fallaba al
// importarse, sin llegar a ejecutar una sola prueba.
//
// Se mockea en vez de parchear `react` porque estas pruebas solo ejercitan la
// VALIDACIÓN del controller —el mismo motivo por el que ya se mockea el repo— y
// cargar la cadena real abriría además un pool de Postgres y tocaría
// `next/headers`. Las OT son un efecto posterior, no parte de lo que se valida.
const eventos = {
  otRetiroPorCancelacion: vi.fn(async () => null),
  otMontajePorAlta: vi.fn(async () => null),
  otReubicacion: vi.fn(async () => null),
}
vi.mock('./operaciones-eventos', () => eventos)

const {
  crearContratoCtrl, agregarPantallaAPredioCtrl, iniciarRenovacionCtrl,
  registrarPagoRentaCtrl, adjuntarAPagoCtrl, obtenerAdjuntoPagoCtrl,
  editarContratoCtrl, crearLicenciaCtrl,
} = await import('./arrendadores-controller')

// Las aserciones de "no se llamó al model" dependen de partir de cero.
beforeEach(() => vi.clearAllMocks())

const CONTRATO = {
  fechaInicio: '2026-01-01', fechaFin: '2026-12-31',
  montoRenta: 10000, periodicidad: 'MENSUAL',
}
const SITIO = { nombre: 'Pantalla 1' }
const ARR = { id: '11111111-1111-1111-1111-111111111111' }

describe('crearContratoCtrl — el predio es obligatorio', () => {
  it('rechaza un contrato SIN predio (si no, nacería con predio_id NULL y no costaría nada en el P&L)', async () => {
    await expect(
      crearContratoCtrl({ arrendador: ARR, contrato: CONTRATO, sitio: SITIO }),
    ).rejects.toThrow(/predio/i)
  })

  it('rechaza un predio nuevo sin nombre', async () => {
    await expect(
      crearContratoCtrl({ arrendador: ARR, predio: { direccion: 'Calle 1' }, contrato: CONTRATO, sitio: SITIO }),
    ).rejects.toThrow(/predio/i)
  })

  it('rechaza coordenadas del predio fuera de rango', async () => {
    await expect(
      crearContratoCtrl({
        arrendador: ARR, predio: { nombre: 'Predio 1', lat: 120, lng: 0 },
        contrato: CONTRATO, sitio: SITIO,
      }),
    ).rejects.toThrow(/latitud/i)
  })

  it('acepta un predio existente por id', async () => {
    const predio = { id: '22222222-2222-2222-2222-222222222222' }
    const r: any = await crearContratoCtrl({ arrendador: ARR, predio, contrato: CONTRATO, sitio: SITIO })
    expect(r.predio).toEqual(predio)
  })

  it('acepta una pantalla del inventario por id (no se re-captura)', async () => {
    const sitio = { id: '55555555-5555-5555-5555-555555555555' }
    const r: any = await crearContratoCtrl({
      arrendador: ARR, predio: { nombre: 'Predio 1' }, contrato: CONTRATO, sitio,
    })
    // Solo el id: mandar los datos del formulario sobrescribiría los de la BD.
    expect(r.sitio).toEqual(sitio)
  })

  it('rechaza una pantalla con id que no es uuid', async () => {
    await expect(crearContratoCtrl({
      arrendador: ARR, predio: { nombre: 'Predio 1' }, contrato: CONTRATO, sitio: { id: 'abc' },
    })).rejects.toThrow(/pantalla/i)
  })

  it('acepta un predio nuevo y lo pasa al repo', async () => {
    const r: any = await crearContratoCtrl({
      arrendador: ARR, predio: { nombre: 'Azotea Reforma 222', direccion: 'Reforma 222' },
      contrato: CONTRATO, sitio: SITIO,
    })
    expect(r.predio.nombre).toBe('Azotea Reforma 222')
    // Estado por defecto del predio recién dado de alta.
    expect(r.predio.estado).toBe('DISPONIBLE')
  })
})

// ============================================================================
//  Agregar pantalla a un predio que YA tiene contrato: N pantallas comparten la
//  renta del predio, sin firmar un segundo contrato (que el P&L no sumaría).
// ============================================================================
describe('agregarPantallaAPredioCtrl', () => {
  const PREDIO = '33333333-3333-3333-3333-333333333333'

  it('liga una pantalla existente por sitioId', async () => {
    const sitioId = '44444444-4444-4444-4444-444444444444'
    const r: any = await agregarPantallaAPredioCtrl(PREDIO, { sitioId })
    expect(r.predioId).toBe(PREDIO)
    expect(r.sitio).toEqual({ id: sitioId })
  })

  it('crea una pantalla nueva ligada al predio', async () => {
    const r: any = await agregarPantallaAPredioCtrl(PREDIO, { nombre: 'Pantalla 2', caras: 2 })
    expect(r.sitio.nombre).toBe('Pantalla 2')
  })

  it('rechaza un cuerpo sin sitioId ni nombre', async () => {
    await expect(agregarPantallaAPredioCtrl(PREDIO, { caras: 2 })).rejects.toThrow()
  })

  it('rechaza un sitioId que no es uuid', async () => {
    await expect(agregarPantallaAPredioCtrl(PREDIO, { sitioId: 'abc' })).rejects.toThrow()
  })
})

// ============================================================================
//  Fechas y montos que antes llegaban crudos a Postgres: el cast fallaba y salía
//  como 500 con el texto del driver, en vez de un 400 con el motivo.
// ============================================================================
describe('iniciarRenovacionCtrl — fecha', () => {
  it('rechaza una fecha que no es fecha (antes: 500 por el cast ::date)', async () => {
    await expect(iniciarRenovacionCtrl('C1', { nuevaFechaFin: 'mañana' })).rejects.toThrow(/fecha/i)
    expect(repo.iniciarRenovacion).not.toHaveBeenCalled()
  })

  it('rechaza un campo desconocido en el cuerpo', async () => {
    await expect(iniciarRenovacionCtrl('C1', { fechaFin: '2027-01-01' })).rejects.toThrow()
  })

  it('acepta renovar sin fecha (el model aplica +365 días)', async () => {
    await expect(iniciarRenovacionCtrl('C1', {})).resolves.toEqual({ id: 'C1' })
  })

  it('traduce fechaNoPosterior del model a 400 con la vigencia actual', async () => {
    repo.iniciarRenovacion.mockResolvedValueOnce({ fechaNoPosterior: '2026-12-31' } as never)
    await expect(iniciarRenovacionCtrl('C1', { nuevaFechaFin: '2026-01-01' }))
      .rejects.toThrow(/posterior a la vigencia actual \(2026-12-31\)/)
  })
})

describe('registrarPagoRentaCtrl — fecha y repago', () => {
  it('rechaza una fecha de pago inválida (antes: 500 por el cast ::timestamptz)', async () => {
    await expect(registrarPagoRentaCtrl('P1', { fechaPago: 'ayer' })).rejects.toThrow(/fecha/i)
    expect(repo.registrarPagoRenta).not.toHaveBeenCalled()
  })

  it('rechaza una fecha de pago futura', async () => {
    const dentroDeUnAno = new Date(Date.now() + 365 * 86_400_000).toISOString()
    await expect(registrarPagoRentaCtrl('P1', { fechaPago: dentroDeUnAno })).rejects.toThrow(/futura/i)
  })

  it('rechaza re-registrar un pago ya PAGADO (409, no sobrescribe la fecha)', async () => {
    repo.registrarPagoRenta.mockResolvedValueOnce({ yaPagado: '2026-03-01' } as never)
    await expect(registrarPagoRentaCtrl('P1', {})).rejects.toThrow(/ya está pagado \(2026-03-01\)/)
  })

  it('registra un pago normal', async () => {
    await expect(registrarPagoRentaCtrl('P1', {})).resolves.toEqual({ id: 'P1' })
  })
})

// ============================================================================
//  Adjuntos (factura/comprobante). El limite del navegador se salta con un curl:
//  el tipo y el tamaño se validan aqui, en el servidor.
// ============================================================================
describe('adjuntos de pago', () => {
  const PDF = 'data:application/pdf;base64,JVBERi0xLjQK'
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
  // ~6 MB de base64 => por encima del limite de 5 MB.
  const GRANDE = 'data:application/pdf;base64,' + 'A'.repeat(8_400_000)

  it('acepta un PDF y una imagen', async () => {
    await expect(adjuntarAPagoCtrl('P1', { facturaUrl: PDF, comprobanteUrl: PNG })).resolves.toBeTruthy()
  })

  it('rechaza un ejecutable disfrazado de adjunto', async () => {
    await expect(adjuntarAPagoCtrl('P1', { facturaUrl: 'data:application/x-msdownload;base64,TVqQ' }))
      .rejects.toThrow(/no permitido/)
  })

  it('rechaza una URL que no es un adjunto', async () => {
    await expect(adjuntarAPagoCtrl('P1', { facturaUrl: 'https://evil.example/factura.pdf' }))
      .rejects.toThrow(/data URL/)
  })

  it('rechaza un adjunto de mas de 5 MB', async () => {
    await expect(adjuntarAPagoCtrl('P1', { facturaUrl: GRANDE })).rejects.toThrow(/5 MB/)
  })

  it('acepta null para borrar un adjunto', async () => {
    const r: any = await adjuntarAPagoCtrl('P1', { facturaUrl: null })
    expect(r.facturaUrl).toBeNull()
  })

  it('rechaza un cuerpo vacio (nada que guardar)', async () => {
    await expect(adjuntarAPagoCtrl('P1', {})).rejects.toThrow(/nada que guardar/)
  })

  it('no re-sella el pago: nunca manda estatus ni fechaPago al model', async () => {
    await adjuntarAPagoCtrl('P1', { facturaUrl: PDF })
    const [, datos] = repo.adjuntarAPago.mock.calls[0] as [string, Record<string, unknown>]
    expect(datos).not.toHaveProperty('estatus')
    expect(datos).not.toHaveProperty('fechaPago')
  })

  it('rechaza un tipo de adjunto desconocido en la ruta', async () => {
    await expect(obtenerAdjuntoPagoCtrl('P1', 'contrato')).rejects.toThrow(/inválido/i)
    expect(repo.obtenerAdjuntoPago).not.toHaveBeenCalled()
  })

  it('devuelve el adjunto pedido', async () => {
    await expect(obtenerAdjuntoPagoCtrl('P1', 'factura')).resolves.toMatch(/^data:application\/pdf/)
  })
})

// ─── UX-01 · la vigencia invertida que detecta el model ─────────────────────
// La regla vive en `editarContrato` porque es lo único que conoce las fechas
// EFECTIVAS (las guardadas más el patch); ver
// arrendadores-repo.fechas-contrato.test.ts. Aquí se comprueba lo que le toca
// al controller: que ese resultado salga como 400 y con las dos fechas dentro,
// y no como un 200 con el contrato roto.
describe('editarContratoCtrl — traduce la vigencia invertida del model', () => {
  it('convierte `fechasInvertidas` en un 400 que nombra las dos fechas', async () => {
    repo.editarContrato.mockResolvedValueOnce({
      fechasInvertidas: { inicio: '2026-01-01', fin: '2025-06-30' },
    })
    await expect(editarContratoCtrl('C1', { fechaFin: '2025-06-30' })).rejects.toMatchObject({
      status: 400,
    })
    repo.editarContrato.mockResolvedValueOnce({
      fechasInvertidas: { inicio: '2026-01-01', fin: '2025-06-30' },
    })
    await expect(editarContratoCtrl('C1', { fechaFin: '2025-06-30' }))
      .rejects.toThrow(/2026-01-01[\s\S]*2025-06-30|2025-06-30[\s\S]*2026-01-01/)
  })

  it('la comprobación del propio controller sigue viva cuando llegan las dos', async () => {
    // Atajo barato: con las dos fechas en el patch no hace falta consultar la
    // fila para saber que están al revés.
    await expect(editarContratoCtrl('C1', { fechaInicio: '2026-06-01', fechaFin: '2026-05-01' }))
      .rejects.toThrow(/anterior a la de inicio/)
    expect(repo.editarContrato).not.toHaveBeenCalled()
  })

  it('una edición correcta devuelve el contrato', async () => {
    repo.editarContrato.mockResolvedValueOnce({ contrato: { id: 'C1' } })
    await expect(editarContratoCtrl('C1', { fechaFin: '2027-12-31' })).resolves.toMatchObject({ id: 'C1' })
  })
})

// ─── UX-01 · las fechas del ALTA tienen que ser fechas ──────────────────────
describe('crearContratoCtrl — fechas que Postgres pueda castear', () => {
  const PREDIO = { nombre: 'Predio 1' }

  it('rechaza una fecha que no es una fecha, y no la manda al model', async () => {
    // El módulo ya aprendió esto en `iniciarRenovacion`: sin el `refine`, un
    // valor como «mañana» llegaba crudo a `$1::date` y salía como error del
    // driver (500) en vez de 400. El alta del contrato se quedó sin la lección.
    await expect(crearContratoCtrl({
      arrendador: ARR, predio: PREDIO, sitio: SITIO,
      contrato: { ...CONTRATO, fechaFin: 'mañana' },
    })).rejects.toThrow(/[Ff]echa/)
    expect(repo.crearContratoConSitio).not.toHaveBeenCalled()
  })

  it('el orden se compara como FECHAS, no como texto', async () => {
    // '2026-9-1' y '2026-10-01' son el mismo orden en el calendario y el
    // contrario en un `<` de cadenas: sin normalizar, un contrato correcto se
    // rechaza y uno invertido pasa.
    await crearContratoCtrl({
      arrendador: ARR, predio: PREDIO, sitio: SITIO,
      contrato: { ...CONTRATO, fechaInicio: '2026-9-1', fechaFin: '2026-10-01' },
    })
    expect(repo.crearContratoConSitio).toHaveBeenCalledTimes(1)
  })

  it('sigue rechazando el fin anterior al inicio', async () => {
    await expect(crearContratoCtrl({
      arrendador: ARR, predio: PREDIO, sitio: SITIO,
      contrato: { ...CONTRATO, fechaInicio: '2026-12-31', fechaFin: '2026-01-01' },
    })).rejects.toThrow(/anterior a la de inicio/)
    expect(repo.crearContratoConSitio).not.toHaveBeenCalled()
  })
})

// ─── VAL-11 · la tercera copia de la comparacion de fechas como TEXTO ───────
//  `validarVigencia` (arrendadores-controller) comparaba
//  `d.fechaVencimiento < d.fechaExpedicion` sobre CADENAS. Es el mismo defecto
//  que UX-01 corrigio en los contratos y que VAL-10 corrigio en el model: solo
//  funciona si las dos fechas llevan ceros a la izquierda, y el cuerpo lo manda
//  quien llama, no la base.
//
//  Una licencia que «vence» antes de expedirse nace vencida: el aviso de
//  vencimiento la marca en rojo el dia uno y el predio queda con un pendiente
//  legal que no lo es.
describe('VAL-11 · la vigencia de la licencia se compara por calendario', () => {
  const base = {
    predioId: '11111111-1111-1111-1111-111111111111',
    tipo: 'MUNICIPAL' as const,
  }

  it('atrapa la inversion aunque las fechas vengan sin ceros a la izquierda', async () => {
    await expect(
      crearLicenciaCtrl({ ...base, fechaExpedicion: '2026-10-01', fechaVencimiento: '2026-9-1' }),
    ).rejects.toThrow('no puede vencer antes de expedirse')
    expect(repo.crearLicencia).not.toHaveBeenCalled()
  })

  it('y no rechaza la licencia correcta con la misma forma', async () => {
    // Control positivo: '2026-9-1' → '2026-10-01' es una vigencia valida y como
    // texto saldria invertida. Si cayera, la regla estaria rota por el otro lado.
    await crearLicenciaCtrl({ ...base, fechaExpedicion: '2026-9-1', fechaVencimiento: '2026-10-01' })
    expect(repo.crearLicencia).toHaveBeenCalledTimes(1)
  })

  it('control: la inversion evidente sigue cayendo', async () => {
    await expect(
      crearLicenciaCtrl({ ...base, fechaExpedicion: '2026-10-01', fechaVencimiento: '2026-01-01' }),
    ).rejects.toThrow('no puede vencer antes de expedirse')
  })
})
