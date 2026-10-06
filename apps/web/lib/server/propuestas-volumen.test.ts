import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
//  EL DESCUENTO POR VOLUMEN SE RESUELVE EN EL SERVIDOR — ADR 0039, Fase 2.
// ----------------------------------------------------------------------------
//  ⚠️ ESTE ARCHIVO EXISTE POR EL HALLAZGO B40, y conviene que quede escrito.
//
//  La cadena de precio de la Fase 1 vive ENTERA en el navegador: `resolverTarifa`
//  solo se llama desde `app/(app)/(shell)/propuestas/page.tsx`, que es un
//  archivo `'use client'`, y `propuestas-controller.ts` copia la
//  `tarifaUnitaria` que manda el cliente tal cual. Se puede cerrar una venta de
//  prime a 1 peso con un `curl`, y queda congelada en el snapshot con toda la
//  apariencia de ser auditable.
//
//  Esta fase NO arregla eso —mover la Fase 1 al servidor cambia el
//  comportamiento de cada venta y es una decisión abierta del dueño (D11)— pero
//  TAMPOCO lo amplía: el escalón de volumen **nace del lado correcto**. El
//  cliente manda la CANTIDAD; el porcentaje lo busca el servidor en la base.
//
//  Lo que estas pruebas fijan, y es lo que impide que eso se deshaga sin querer:
//   · el porcentaje NO puede entrar por el cuerpo — ni por el zod ni por el tipo;
//   · se lee de `listarEscalasVolumen()`, o sea bajo RLS, con el tenant de la
//     sesión;
//   · sin escala capturada la venta sale exactamente igual que ayer.
// ============================================================================

const { crearPropuestaMock } = vi.hoisted(() => ({
  crearPropuestaMock: vi.fn(async (input: unknown) => ({ id: 'P1', input })),
}))
const { listarEscalasMock } = vi.hoisted(() => ({
  listarEscalasMock: vi.fn(async () => [] as any[]),
}))

vi.mock('./propuestas-repo', () => ({
  crearPropuesta: (input: unknown) => crearPropuestaMock(input),
  aprobarItem: vi.fn(),
  PropuestaError: class PropuestaError extends Error {},
  validarRangoFechas: vi.fn(),
}))
vi.mock('./rejilla-repo', () => ({
  listarFranjas: vi.fn(async () => []),
  listarTemporadas: vi.fn(async () => []),
}))
vi.mock('./volumen-repo', () => ({
  listarEscalasVolumen: () => listarEscalasMock(),
  guardarTramoVolumen: vi.fn(),
  borrarTramoVolumen: vi.fn(),
}))

// PRECIO-01 · desde el 2026-10-01 el controller calcula la tarifa de cada línea
// (`tarifas-repo`) y, si el precio se aparta, pregunta el permiso de la SESIÓN
// (`auth`). Se sustituyen por el mismo motivo que los de arriba. Sesión de
// DUEÑO y sin tarifas: toda línea pasa como ajuste de alguien con permiso, que
// es neutro para el volumen. La regla del precio vive en `propuestas-precio.test.ts`.
vi.mock('./tarifas-repo', () => ({
  datosParaTarifar: vi.fn(async () => ({ sitios: new Map(), temporadas: [] })),
}))
vi.mock('./auth', () => ({
  usuarioActual: vi.fn(async () => ({ id: 'U-DUENO', rol: 'DUENO' })),
  tienePermiso: vi.fn(async () => true),
}))

import { crearPropuestaCtrl } from './propuestas-controller'

const CUERPO = {
  nombre: 'Campaña de prueba',
  fechaInicio: '2026-11-13',
  fechaFin: '2026-11-16',
  items: [{ sitioId: 'S1', unidad: 'spot', tarifaUnitaria: 1200, cantidad: 50 }],
}

const ESCALA = [
  { id: 'T1', unidad: 'spot', desdeCantidad: 10, descuentoPct: 5 },
  { id: 'T2', unidad: 'spot', desdeCantidad: 50, descuentoPct: 10 },
]

beforeEach(() => {
  crearPropuestaMock.mockClear()
  listarEscalasMock.mockClear()
  listarEscalasMock.mockResolvedValue([])
})

const enviado = () => crearPropuestaMock.mock.calls[0][0] as any

describe('1 · el servidor resuelve el volumen, y solo el servidor', () => {
  it('con la escala capturada, 50 spots llevan su 10 % y el umbral que lo ganó', async () => {
    listarEscalasMock.mockResolvedValue(ESCALA)
    await crearPropuestaCtrl(CUERPO)
    expect(enviado().items[0].descuentoVolumenPct).toBe(10)
    expect(enviado().items[0].volumenDesde).toBe(50)
  })

  it('el porcentaje que manda el CLIENTE se ignora por completo', async () => {
    // Es el caso B40 en miniatura: si esto se aceptara, un `curl` cerraría la
    // venta al 90 % y quedaría congelada como si la hubiera decidido la escala.
    listarEscalasMock.mockResolvedValue(ESCALA)
    await crearPropuestaCtrl({
      ...CUERPO,
      items: [{ ...CUERPO.items[0], descuentoVolumenPct: 90, volumenDesde: 1 }],
    })
    expect(enviado().items[0].descuentoVolumenPct).toBe(10)
    expect(enviado().items[0].volumenDesde).toBe(50)
  })

  it('el ESQUEMA de entrada no declara el porcentaje: el candado es el tipo', () => {
    // Mismo candado que el vendedor de VEND-01. Si alguien añade el campo al
    // zod, esta prueba cae y le obliga a explicar por qué reabre el agujero.
    const fuente = readFileSync(join(__dirname, 'propuestas-controller.ts'), 'utf8')
    const itemSchema = fuente.slice(
      fuente.indexOf('const itemSchema'),
      fuente.indexOf('const crearSchema'),
    )
    expect(itemSchema, 'el itemSchema no puede aceptar el descuento por volumen')
      .not.toMatch(/descuentoVolumenPct/)
    expect(itemSchema).not.toMatch(/volumenDesde/)
  })

  it('la escala se lee UNA sola vez por propuesta, no una por linea', async () => {
    listarEscalasMock.mockResolvedValue(ESCALA)
    await crearPropuestaCtrl({
      ...CUERPO,
      items: [
        { sitioId: 'S1', unidad: 'spot', tarifaUnitaria: 1200, cantidad: 50 },
        { sitioId: 'S2', unidad: 'spot', tarifaUnitaria: 900, cantidad: 60 },
        { sitioId: 'S3', unidad: 'spot', tarifaUnitaria: 800, cantidad: 5 },
      ],
    })
    expect(listarEscalasMock).toHaveBeenCalledTimes(1)
  })
})

describe('2 · vender SIN escala sigue funcionando — invariante 3', () => {
  it('sin tramos capturados el item llega con 0 y sin umbral', async () => {
    await crearPropuestaCtrl(CUERPO)
    expect(enviado().items[0].descuentoVolumenPct).toBe(0)
    expect(enviado().items[0].volumenDesde).toBeNull()
  })

  it('el PRECIO de la linea sigue siendo el de LISTA: el volumen NO se mete en `precio`', async () => {
    // `precio` es `tarifa × cantidad` y tiene que seguir cuadrando con su propia
    // multiplicación, o el documento enseña un importe que no da. El volumen se
    // aplica como una capa explícita sobre el bruto de la propuesta.
    listarEscalasMock.mockResolvedValue(ESCALA)
    await crearPropuestaCtrl(CUERPO)
    expect(enviado().items[0].precio).toBe(60000)
    expect(enviado().items[0].tarifaUnitaria).toBe(1200)
  })

  it('una unidad sin tramos no descuenta aunque otra unidad si los tenga', async () => {
    listarEscalasMock.mockResolvedValue(ESCALA) // solo 'spot'
    await crearPropuestaCtrl({
      ...CUERPO,
      items: [{ sitioId: 'S1', unidad: 'mensual', tarifaUnitaria: 30000, cantidad: 1 }],
    })
    expect(enviado().items[0].descuentoVolumenPct).toBe(0)
  })

  it('y NO se le aplica el tramo de OTRA unidad aunque la cantidad lo alcance', async () => {
    // ⚠️ De un MUTANTE QUE SOBREVIVIO: quitar el filtro por unidad no rompia la
    // prueba de arriba, porque alli la cantidad era 1 y no llegaba a ningun
    // umbral. El fallo real es este: 10 spots cobrando el tramo pensado para
    // «6 meses». Nadie ve un error; se ve una venta mas barata.
    listarEscalasMock.mockResolvedValue([
      { id: 'M1', unidad: 'mensual', desdeCantidad: 6, descuentoPct: 8 },
    ])
    await crearPropuestaCtrl({
      ...CUERPO,
      items: [{ sitioId: 'S1', unidad: 'spot', tarifaUnitaria: 1200, cantidad: 10 }],
    })
    expect(enviado().items[0].descuentoVolumenPct).toBe(0)
    expect(enviado().items[0].volumenDesde).toBeNull()
  })

  it('el modo compatible (precio directo, sin unidad ni tarifa) tambien pasa por la escala', async () => {
    // Ese camino pone `cantidad: 1`, así que jamás alcanza un umbral: lo que se
    // fija aquí es que el campo llegue explícito y no en `undefined`.
    listarEscalasMock.mockResolvedValue(ESCALA)
    await crearPropuestaCtrl({
      ...CUERPO,
      items: [{ sitioId: 'S1', precio: 5000 }],
    })
    expect(enviado().items[0].descuentoVolumenPct).toBe(0)
    expect(enviado().items[0].volumenDesde).toBeNull()
  })
})

describe('3 · la cantidad que cuenta es la EFECTIVA, no la que llega en el cuerpo', () => {
  it('en unidades de tiempo la cantidad sale del rango de fechas', async () => {
    // 2026-11-01 a 2027-04-30 son 6 meses DE CALENDARIO (noviembre a abril).
    // Decía «181 días = 7 meses» hasta el 2026-10-02: con la regla de 30 días se
    // cobraba un mes que no existe. Con un tramo «desde 6 meses» tiene que
    // entrar igual, aunque el cuerpo no mande ninguna `cantidad`.
    listarEscalasMock.mockResolvedValue([
      { id: 'M1', unidad: 'mensual', desdeCantidad: 6, descuentoPct: 8 },
    ])
    await crearPropuestaCtrl({
      nombre: 'Anual',
      fechaInicio: '2026-11-01',
      fechaFin: '2027-04-30',
      items: [{ sitioId: 'S1', unidad: 'mensual', tarifaUnitaria: 30000 }],
    })
    expect(enviado().items[0].cantidad).toBe(6)
    expect(enviado().items[0].descuentoVolumenPct).toBe(8)
  })

  it('una `cantidad` inflada en el cuerpo NO regala el tramo: en tiempo se ignora', async () => {
    listarEscalasMock.mockResolvedValue([
      { id: 'M1', unidad: 'mensual', desdeCantidad: 6, descuentoPct: 8 },
    ])
    await crearPropuestaCtrl({
      nombre: 'Un mes',
      fechaInicio: '2026-11-01',
      fechaFin: '2026-11-30',
      items: [{ sitioId: 'S1', unidad: 'mensual', tarifaUnitaria: 30000, cantidad: 999 }],
    })
    expect(enviado().items[0].cantidad).toBe(1)
    expect(enviado().items[0].descuentoVolumenPct).toBe(0)
  })
})
