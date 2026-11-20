import { describe, it, expect } from 'vitest'
import { derivarPendientes, soloImpresion, type DatosPendientes } from './pendientes-creativo'

// ============================================================================
//  FLUJO-CREA (20/11) · la «tarea 1»: con el creativo aprobado, cada sitio de la
//  campaña queda PENDIENTE de que una persona lo mande a impresión (fijo) o lo
//  programe (digital). Nada se guarda: se DERIVA de lo que ya hay.
// ============================================================================

const camp = (over: Partial<DatosPendientes['campanas'][number]> = {}) => ({
  id: 'c1',
  nombre: 'Lona Reforma',
  folio: 'CMP-2026-0001',
  tipo: 'OOH',
  estado: 'CONFIRMADA',
  inicio: '2026-12-01',
  enviadaDominio: false,
  ...over,
})

const base = (over: Partial<DatosPendientes> = {}): DatosPendientes => ({
  campanas: [camp()],
  reservas: [{ campanaId: 'c1', sitioId: 's-fijo', sitioNombre: 'Valla Reforma', digital: false, ancho: 12.9, alto: 7.2, creativos: [] }],
  creativos: [{ id: 'k1', campanaId: 'c1', nombre: 'arte.jpg', estatus: 'VALIDADA', origen: 'INTERNO' }],
  envios: [],
  ordenes: [],
  ...over,
})

describe('derivarPendientes · fijos → «Mandar a impresión»', () => {
  it('creativo aprobado y sin orden de impresión para ese sitio → pendiente IMPRIMIR', () => {
    const p = derivarPendientes(base())
    expect(p).toHaveLength(1)
    expect(p[0]).toMatchObject({
      accion: 'IMPRIMIR',
      campanaId: 'c1',
      sitioId: 's-fijo',
      sitioNombre: 'Valla Reforma',
      sitioAncho: 12.9,
      sitioAlto: 7.2,
      campanaInicio: '2026-12-01',
    })
    expect(p[0].creativos).toEqual([{ id: 'k1', nombre: 'arte.jpg', estatus: 'VALIDADA', origen: 'INTERNO' }])
  })

  it('con la orden de impresión de ESE sitio ya creada, el pendiente desaparece', () => {
    expect(derivarPendientes(base({ ordenes: [{ campanaId: 'c1', sitioId: 's-fijo' }] }))).toEqual([])
  })

  it('una orden de OTRO sitio, o sin sitio, no tapa el pendiente', () => {
    expect(derivarPendientes(base({ ordenes: [{ campanaId: 'c1', sitioId: 'otro' }] }))).toHaveLength(1)
    expect(derivarPendientes(base({ ordenes: [{ campanaId: 'c1', sitioId: null }] }))).toHaveLength(1)
    // Ni la del mismo sitio en OTRA campaña.
    expect(derivarPendientes(base({ ordenes: [{ campanaId: 'c9', sitioId: 's-fijo' }] }))).toHaveLength(1)
  })

  it('sin creativo aprobado no hay nada que mandar (pendiente, rechazado o retirado no cuentan)', () => {
    for (const estatus of ['PENDIENTE', 'RECHAZADA'] as const) {
      const p = derivarPendientes(base({ creativos: [{ id: 'k1', campanaId: 'c1', nombre: 'a', estatus, origen: 'INTERNO' }] }))
      expect(p.filter((x) => x.accion === 'IMPRIMIR')).toEqual([])
    }
    const retirado = derivarPendientes(
      base({ creativos: [{ id: 'k1', campanaId: 'c1', nombre: 'a', estatus: 'VALIDADA', origen: 'INTERNO', retirado: true }] }),
    )
    expect(retirado).toEqual([])
  })

  it('solo campañas vendidas y vivas: CONFIRMADA o ACTIVA', () => {
    for (const estado of ['DRAFT', 'COTIZACION', 'CANCELADA', 'COMPLETADA', 'LISTA_FACTURAR']) {
      expect(derivarPendientes(base({ campanas: [camp({ estado })] }))).toEqual([])
    }
    expect(derivarPendientes(base({ campanas: [camp({ estado: 'ACTIVA' })] }))).toHaveLength(1)
  })

  it('una campaña DOOH no imprime aunque tenga un sitio fijo (la API lo rechazaría)', () => {
    expect(derivarPendientes(base({ campanas: [camp({ tipo: 'DOOH' })] }))).toEqual([])
  })

  it('el origen del creativo viaja: CLIENTE si llegó por la liga', () => {
    const p = derivarPendientes(base({ creativos: [{ id: 'k1', campanaId: 'c1', nombre: 'del-cliente.png', estatus: 'VALIDADA', origen: 'CLIENTE' }] }))
    expect(p[0].creativos[0].origen).toBe('CLIENTE')
  })

  it('un sitio reservado dos veces en la misma campaña sale una sola vez', () => {
    const r = base().reservas[0]
    expect(derivarPendientes(base({ reservas: [r, { ...r }] }))).toHaveLength(1)
  })
})

describe('derivarPendientes · digitales → «Programar»', () => {
  const dig = (over: Partial<DatosPendientes> = {}) =>
    base({
      campanas: [camp({ tipo: 'DOOH' })],
      reservas: [{ campanaId: 'c1', sitioId: 's-dig', sitioNombre: 'Pantalla Insurgentes', digital: true, ancho: null, alto: null, creativos: ['k1'] }],
      ...over,
    })

  it('creativo aprobado asignado a la pantalla y la campaña sin enviar al dominio → PROGRAMAR', () => {
    const p = derivarPendientes(dig())
    expect(p).toHaveLength(1)
    expect(p[0]).toMatchObject({ accion: 'PROGRAMAR', sitioId: 's-dig' })
    expect(p[0].creativos.map((c) => c.id)).toEqual(['k1'])
  })

  it('ya enviada al dominio (programada) → desaparece', () => {
    expect(derivarPendientes(dig({ campanas: [camp({ tipo: 'DOOH', enviadaDominio: true })] }))).toEqual([])
  })

  it('pantalla sin el creativo aprobado asignado → no hay qué programar', () => {
    const r = dig().reservas[0]
    expect(derivarPendientes(dig({ reservas: [{ ...r, creativos: [] }] }))).toEqual([])
    // Asignado, pero ya no aprobado (p. ej. se rechazó después).
    expect(
      derivarPendientes(dig({ creativos: [{ id: 'k1', campanaId: 'c1', nombre: 'a', estatus: 'RECHAZADA', origen: 'INTERNO' }] })),
    ).toEqual([])
  })

  it('una HÍBRIDA da las dos tareas: imprimir la fija y programar la digital', () => {
    const p = derivarPendientes(
      base({
        campanas: [camp({ tipo: 'HIBRIDA' })],
        reservas: [
          base().reservas[0],
          { campanaId: 'c1', sitioId: 's-dig', sitioNombre: 'Pantalla', digital: true, ancho: null, alto: null, creativos: ['k1'] },
        ],
      }),
    )
    expect(p.map((x) => x.accion).sort()).toEqual(['IMPRIMIR', 'PROGRAMAR'])
    expect(soloImpresion(p).map((x) => x.accion)).toEqual(['IMPRIMIR'])
  })
})

describe('derivarPendientes · «por aprobar», con su origen', () => {
  it('un envío del cliente pendiente → POR_APROBAR de origen CLIENTE, con su pantalla', () => {
    const p = derivarPendientes(
      base({ creativos: [], envios: [{ id: 'e1', campanaId: 'c1', sitioId: 's-fijo', sitioNombre: 'Valla Reforma', nombreArchivo: 'lona.png' }] }),
    )
    expect(p).toEqual([
      expect.objectContaining({
        accion: 'POR_APROBAR',
        sitioId: 's-fijo',
        creativos: [{ id: null, nombre: 'lona.png', estatus: 'PENDIENTE', origen: 'CLIENTE' }],
      }),
    ])
  })

  it('un creativo nuestro PENDIENTE → POR_APROBAR de origen INTERNO, sin botón de imprimir (no es IMPRIMIR)', () => {
    const p = derivarPendientes(base({ creativos: [{ id: 'k2', campanaId: 'c1', nombre: 'nuestro.jpg', estatus: 'PENDIENTE', origen: 'INTERNO' }] }))
    expect(p.map((x) => x.accion)).toEqual(['POR_APROBAR'])
    expect(p[0].creativos[0]).toEqual({ id: 'k2', nombre: 'nuestro.jpg', estatus: 'PENDIENTE', origen: 'INTERNO' })
    expect(soloImpresion(p)).toEqual([])
  })
})

describe('derivarPendientes · orden y claves', () => {
  it('lo que arranca antes va primero, y cada pendiente tiene una clave estable y única', () => {
    const p = derivarPendientes({
      campanas: [camp({ id: 'tarde', inicio: '2027-02-01' }), camp({ id: 'pronto', inicio: '2026-11-25' })],
      reservas: [
        { campanaId: 'tarde', sitioId: 's1', sitioNombre: 'A', digital: false, ancho: 1, alto: 1, creativos: [] },
        { campanaId: 'pronto', sitioId: 's1', sitioNombre: 'A', digital: false, ancho: 1, alto: 1, creativos: [] },
      ],
      creativos: [
        { id: 'a', campanaId: 'tarde', nombre: 'a', estatus: 'VALIDADA', origen: 'INTERNO' },
        { id: 'b', campanaId: 'pronto', nombre: 'b', estatus: 'VALIDADA', origen: 'INTERNO' },
      ],
      envios: [],
      ordenes: [],
    })
    expect(p.map((x) => x.campanaId)).toEqual(['pronto', 'tarde'])
    expect(new Set(p.map((x) => x.clave)).size).toBe(2)
    expect(p[0].clave).toBe('IMPRIMIR:pronto:s1')
  })
})

describe('esFechaReal', () => {
  it('acepta un día que existe y rechaza el resto', async () => {
    const { esFechaReal } = await import('./pendientes-creativo')
    expect(esFechaReal('2026-11-20')).toBe(true)
    expect(esFechaReal('2028-02-29')).toBe(true)
    for (const x of ['2026-02-30', '2026-13-01', '20261120', '2026-11-20T00:00', 'mañana']) expect(esFechaReal(x)).toBe(false)
  })
})
