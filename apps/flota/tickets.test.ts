import { describe, expect, it } from 'vitest'

import { filasDeTickets, SIN_RESPUESTA } from './tickets.mjs'

// ============================================================================
//  Pruebas de la logica pura del panel de tickets (T8 del Plan_Tickets_De_
//  Soporte, ADR 0038).
// ----------------------------------------------------------------------------
//  `filasDeTickets()` no abre ningun puerto: toma lo que YA contesto cada
//  instancia -- el JSON de `GET /api/tickets` (T6), o su ausencia -- y lo
//  convierte en una fila por instancia. La pieza de red (fetch, timeouts,
//  token) es de T9, igual que `consultar()` en estado.mjs se prueba inyectando
//  un `pedir` falso en vez de un servidor real.
//
//  La tercera prueba es la que el ADR 0038 marca en sus consecuencias: «la
//  pantalla tiene que distinguir "no tiene tickets" de "no me contesta", o
//  repite el error de leer un silencio como una buena noticia».
// ============================================================================

/** Un ticket con la forma exacta que fija T6 (progress.md, "Contrato de GET /api/tickets"). */
function ticket(estado: string, over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'id-' + Math.random().toString(36).slice(2),
    folio: 'TK-2026-0001',
    tenant_id: 'tenant-1',
    asunto: 'la pantalla de reportes no carga',
    cuerpo: 'al abrir /reportes se queda en blanco',
    estado,
    prioridad: 'NORMAL',
    creado_en: '2026-09-20T10:00:00.000Z',
    respuesta: null,
    respondido_en: null,
    ...over,
  }
}

describe('filasDeTickets', () => {
  it('agrupa por instancia y cuenta los pendientes', () => {
    const filas = filasDeTickets([
      {
        nombre: 'g500',
        dominio: 'g500.ejemplo.invalid',
        tickets: [ticket('ABIERTO'), ticket('ABIERTO'), ticket('RESUELTO'), ticket('CERRADO')],
      },
      {
        nombre: 'pixeled',
        dominio: 'pixeled.ejemplo.invalid',
        tickets: [ticket('EN_PROCESO')],
      },
    ])

    expect(filas).toHaveLength(2)

    const porNombre = Object.fromEntries(filas.map((f) => [f.nombre, f]))
    expect(porNombre.g500.pendientes).toBe(2)
    expect(porNombre.g500.total).toBe(4)
    expect(porNombre.g500.estado).toBe('ok')
    // Esta linea decia `toBe(0)` con un unico ticket EN_PROCESO, y era el
    // defecto escrito como aserto: una instancia con trabajo empezado y sin
    // cerrar figuraba como que no tenia NADA pendiente.
    expect(porNombre.pixeled.pendientes).toBe(1)
    expect(porNombre.pixeled.total).toBe(1)
  })

  it('una instancia sin tickets sale con 0', () => {
    const [fila] = filasDeTickets([
      { nombre: 'g500', dominio: 'g500.ejemplo.invalid', tickets: [] },
    ])
    expect(fila.pendientes).toBe(0)
    expect(fila.total).toBe(0)
    expect(fila.estado).toBe('ok')
  })

  it('una instancia que NO contesta sale "sin-respuesta", NUNCA como 0', () => {
    const [fila] = filasDeTickets([
      {
        nombre: 'g500',
        dominio: 'g500.ejemplo.invalid',
        motivo: 'el dominio no resuelve (ENOTFOUND)',
      },
    ])
    expect(fila.estado).toBe(SIN_RESPUESTA)
    // El punto del ADR: nunca 0. Ni pendientes ni total pueden confundirse con
    // «esta instancia no tiene tickets».
    expect(fila.pendientes).not.toBe(0)
    expect(fila.total).not.toBe(0)
    expect(fila.pendientes).toBeNull()
    expect(fila.total).toBeNull()
    expect(fila.motivo).toBe('el dominio no resuelve (ENOTFOUND)')
  })

  it('no distingue "tickets ausente" de "tickets no es una lista": las dos son sin-respuesta', () => {
    const filas = filasDeTickets([
      { nombre: 'a', dominio: 'a.invalid' },
      { nombre: 'b', dominio: 'b.invalid', tickets: null },
    ])
    expect(filas.every((f) => f.estado === SIN_RESPUESTA)).toBe(true)
  })
})

// ============================================================================
//  Lo que la pantalla tiene que ENSEÑAR es lo que hay que atender, y un ticket
//  EN_PROCESO hay que atenderlo: alguien lo empezo y no lo ha cerrado.
//
//  Contarlo solo como `ABIERTO` haria que mover un ticket a «en proceso» lo
//  BORRARA de la cuenta, y la pantalla diria que no queda nada por hacer. Es el
//  mismo error que esta pantalla viene a evitar -- leer un silencio como una
//  buena noticia -- aplicado al numero que mas se mira.
//
//  Por eso el campo se llama `pendientes` y no `pendientes`: si contara dos
//  estados llamandose `pendientes`, el nombre mentiria.
// ============================================================================
describe('lo pendiente incluye lo que ya se empezo', () => {
  it('cuenta ABIERTO y EN_PROCESO, y deja fuera RESUELTO y CERRADO', () => {
    const [fila] = filasDeTickets([
      {
        nombre: 'g500',
        dominio: 'g500.example.invalid',
        tickets: [
          ticket('ABIERTO'),
          ticket('EN_PROCESO'),
          ticket('RESUELTO'),
          ticket('CERRADO'),
        ],
      },
    ])
    expect(fila.pendientes).toBe(2)
    expect(fila.total).toBe(4)
  })

  it('una instancia muda sigue sin decir cero', () => {
    const [fila] = filasDeTickets([{ nombre: 'g500', dominio: 'g500.example.invalid' }])
    expect(fila.estado).toBe(SIN_RESPUESTA)
    expect(fila.pendientes).toBeNull()
  })
})
