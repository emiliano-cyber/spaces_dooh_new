import { describe, it, expect } from 'vitest'
import { textoDeEstado, formularioValido } from './tickets-ui'
import type { Ticket } from '@/lib/data/tickets-api'

function ticket(over: Partial<Ticket> = {}): Ticket {
  return {
    id: 'id-1',
    folio: 'TK-2026-0001',
    asunto: 'Asunto',
    cuerpo: 'Cuerpo',
    estado: 'ABIERTO',
    prioridad: 'NORMAL',
    creadoPorUsuario: null,
    creadoEn: '2026-09-22T10:00:00.000Z',
    actualizadoEn: '2026-09-22T10:00:00.000Z',
    respuesta: null,
    respondidoEn: null,
    ...over,
  }
}

// EL ORDEN DE LAS RAMAS ES LA PRUEBA (igual que actualizaciones-ui.test.ts):
// 1. sin ninguno, 2. hay esperando respuesta, 3. todos contestados. Escribir
// estas ramas en otro orden hace que una tape a la otra -- por eso el caso 2
// mezcla a proposito un ticket sin respuesta con uno que SI la tiene: si la
// rama "todos contestados" se evaluara antes, este caso se leeria como que ya
// contestaron todo, que es mentira mientras quede uno sin respuesta.
describe('textoDeEstado', () => {
  it('sin ningun ticket, lo dice y en tono neutro', () => {
    const r = textoDeEstado([])
    expect(r.tono).toBe('info')
    expect(r.texto).toMatch(/no has abierto ning/i)
  })

  it('con alguno sin respuesta, cuenta cuantos esperan -- aunque otros ya tengan respuesta', () => {
    const r = textoDeEstado([
      ticket({ id: '1', respuesta: null }),
      ticket({ id: '2', respuesta: 'Ya lo revisamos' }),
    ])
    expect(r.tono).toBe('info')
    expect(r.texto).toMatch(/1 ticket esperando respuesta/i)
  })

  it('con todos contestados, lo dice en tono positivo', () => {
    const r = textoDeEstado([
      ticket({ id: '1', respuesta: 'Ya' }),
      ticket({ id: '2', respuesta: 'Tambien' }),
    ])
    expect(r.tono).toBe('ok')
    expect(r.texto).toMatch(/contestad/i)
  })
})

describe('formularioValido', () => {
  it('rechaza asunto y/o cuerpo vacios o solo espacios', () => {
    expect(formularioValido('', '')).toBe(false)
    expect(formularioValido('   ', '   ')).toBe(false)
    expect(formularioValido('Asunto', '   ')).toBe(false)
    expect(formularioValido('   ', 'Cuerpo')).toBe(false)
  })

  it('acepta cuando ambos tienen contenido', () => {
    expect(formularioValido('Asunto', 'Cuerpo')).toBe(true)
  })
})
