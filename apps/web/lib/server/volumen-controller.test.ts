import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  El controller de la escala de volumen: quién le pasa «los otros» a la regla.
// ----------------------------------------------------------------------------
//  La REGLA vive en `lib/volumen.ts` y tiene sus propias pruebas. Lo que se fija
//  aquí es el punto donde un olvido la deja inservible: **que se compare contra
//  los tramos que ya existen**. Pasarle una lista vacía no daría ningún error
//  —se guardaría tan ricamente— y el resultado sería una escala en la que
//  comprar más sale más caro, descubierta por un cliente haciendo la cuenta.
//
//  Y la otra mitad: que el `id` de la ruta mande, y que un tramo que no es de
//  esta organización dé 404 y no 403 — decir «existe pero no es tuyo» ya cuenta
//  algo de la otra.
// ============================================================================

const { listarMock, guardarMock, borrarMock } = vi.hoisted(() => ({
  listarMock: vi.fn(async () => [] as any[]),
  guardarMock: vi.fn(async (t: any) => ({ id: 'T9', ...t })),
  // `borrarMock` se declara CON su parámetro aunque el cuerpo no lo use: sin él,
  // `vi.fn` infiere `() => …` y la línea que lo llama con un `id` deja de
  // compilar — que es lo que pasó al escribir este archivo.
  borrarMock: vi.fn(async (_id: string) => true),
}))

vi.mock('./volumen-repo', () => ({
  listarEscalasVolumen: () => listarMock(),
  guardarTramoVolumen: (t: any) => guardarMock(t),
  borrarTramoVolumen: (id: string) => borrarMock(id),
}))

const { listarEscalasCtrl, guardarTramoCtrl, borrarTramoCtrl } =
  await import('./volumen-controller')
const { AppError } = await import('./errores')

beforeEach(() => {
  listarMock.mockClear()
  guardarMock.mockClear()
  borrarMock.mockClear()
  listarMock.mockResolvedValue([])
  borrarMock.mockResolvedValue(true as never)
})

describe('guardarTramoCtrl', () => {
  it('COMPARA contra los tramos que ya existen: la escala no monotona no entra', async () => {
    listarMock.mockResolvedValue([
      { id: 'T1', unidad: 'spot', desdeCantidad: 50, descuentoPct: 10 },
    ])
    await expect(
      guardarTramoCtrl({ unidad: 'spot', desdeCantidad: 100, descuentoPct: 5 }),
    ).rejects.toThrow(/comprar mas/i)
    expect(guardarMock, 'no se puede haber escrito nada').not.toHaveBeenCalled()
  })

  it('el umbral repetido se rechaza con una frase, antes de tocar la base', async () => {
    listarMock.mockResolvedValue([
      { id: 'T1', unidad: 'spot', desdeCantidad: 50, descuentoPct: 10 },
    ])
    await expect(
      guardarTramoCtrl({ unidad: 'spot', desdeCantidad: 50, descuentoPct: 20 }),
    ).rejects.toThrow(/ya hay un tramo/i)
    expect(guardarMock).not.toHaveBeenCalled()
  })

  it('un tramo coherente SI se guarda, con los valores ya convertidos a numero', async () => {
    listarMock.mockResolvedValue([
      { id: 'T1', unidad: 'spot', desdeCantidad: 50, descuentoPct: 10 },
    ])
    const r = await guardarTramoCtrl({ unidad: 'spot', desdeCantidad: '100', descuentoPct: '15' })
    expect(guardarMock).toHaveBeenCalledWith({
      id: undefined,
      unidad: 'spot',
      desdeCantidad: 100,
      descuentoPct: 15,
    })
    expect(r.descuentoPct).toBe(15)
  })

  it('al EDITAR no se compara consigo mismo', async () => {
    listarMock.mockResolvedValue([
      { id: 'T1', unidad: 'spot', desdeCantidad: 50, descuentoPct: 10 },
    ])
    await expect(
      guardarTramoCtrl({ id: 'T1', unidad: 'spot', desdeCantidad: 50, descuentoPct: 12 }),
    ).resolves.toBeTruthy()
  })

  it('una unidad que no esta en la lista se rechaza', async () => {
    // Una unidad mal escrita no rompe nada: hace que el tramo NO aplique jamás.
    // El dueño creería que descuenta y cobraría el precio entero, sin un error.
    await expect(
      guardarTramoCtrl({ unidad: 'quincenal', desdeCantidad: 50, descuentoPct: 10 }),
    ).rejects.toThrow()
    expect(guardarMock).not.toHaveBeenCalled()
  })

  it('un tramo de OTRA organizacion da 404, no 403', async () => {
    guardarMock.mockResolvedValue(null as never)
    await expect(
      guardarTramoCtrl({ id: 'ajeno', unidad: 'spot', desdeCantidad: 50, descuentoPct: 10 }),
    ).rejects.toMatchObject({ status: 404 })
  })
})

describe('borrarTramoCtrl', () => {
  it('borra y devuelve ok', async () => {
    expect(await borrarTramoCtrl('T1')).toEqual({ ok: true })
    expect(borrarMock).toHaveBeenCalledWith('T1')
  })

  it('uno ajeno da 404', async () => {
    borrarMock.mockResolvedValue(false as never)
    await expect(borrarTramoCtrl('ajeno')).rejects.toMatchObject({ status: 404 })
  })
})

describe('listarEscalasCtrl', () => {
  it('devuelve los tramos bajo la clave `tramos`', async () => {
    listarMock.mockResolvedValue([
      { id: 'T1', unidad: 'spot', desdeCantidad: 50, descuentoPct: 10 },
    ])
    expect(await listarEscalasCtrl()).toEqual({
      tramos: [{ id: 'T1', unidad: 'spot', desdeCantidad: 50, descuentoPct: 10 }],
    })
  })

  it('AppError existe y lleva status: el 404 de arriba no es un objeto cualquiera', () => {
    expect(new AppError('x', 404).status).toBe(404)
  })
})
