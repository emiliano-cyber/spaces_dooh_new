import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  VAL-09 · las DOS rutas públicas escriben un nombre sin tope de largo.
// ----------------------------------------------------------------------------
//  `POST /api/firma/[token]` y `POST /api/propuestas/publica/[id]` son las dos
//  únicas escrituras SIN SESIÓN de la aplicación: las abre alguien de fuera con
//  una liga. Las dos exigen un nombre y ninguna lo acota por arriba.
//
//   · `firmarPorToken` comprobaba `nombre.length < 3` y nada más
//     (`firmas-repo.ts:316`). Lo que se escribe es `nombre_firmante`, en el
//     registro de una firma electrónica: no hay ninguna ruta en la aplicación
//     que lo corrija después. Un nombre de 5 000 caracteres queda ahí para
//     siempre y sale impreso en el expediente del contrato.
//   · `aceptarPropuestaPublica` solo comprobaba que no estuviera vacío
//     (`propuestas-repo.ts:280`). Escribe `aceptado_por`, y aceptar es
//     idempotente: la segunda llamada devuelve la aceptación ya registrada en
//     vez de rehacerla, así que tampoco hay forma de enmendarlo.
//
//  240 es el tope: el doble de lo que mide un nombre legal largo de verdad
//  («María de los Ángeles …» con dos apellidos compuestos y un cargo detrás).
//  Se elige holgado a propósito — un tope que estorbe acaba quitándose entero,
//  que es como se llegó a no tener ninguno.
// ============================================================================

const consultas: { texto: string; params: unknown[] }[] = []
const TOKEN = 'a'.repeat(64)

vi.mock('./db', () => ({
  qRaw1: vi.fn(async () => ({ tenant: 't1' })),
  qConTenant: vi.fn(async (_t: string, texto: string, params: unknown[] = []) => {
    consultas.push({ texto, params })
    if (/from contrato_firmas f/i.test(texto)) {
      return [
        {
          contrato_id: 'ctr-1',
          parte: 'ARRENDADOR',
          estatus: 'PENDIENTE',
          nombre_esperado: 'Juan Pérez',
          token_expira_en: null,
          documento_congelado: 'TEXTO DEL CONTRATO',
          documento_hash: 'h'.repeat(64),
        },
      ]
    }
    if (/update contrato_firmas/i.test(texto)) return [{ id: 'firma-1' }]
    return []
  }),
  q: vi.fn(async () => []),
  q1: vi.fn(async () => null),
  pool: { connect: vi.fn() },
  fijarTenant: vi.fn(async () => {}),
}))
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 't1') }))
vi.mock('./contrato-expediente', () => ({ expedienteContrato: vi.fn(async () => null) }))

const { firmarPorToken } = await import('./firmas-repo')
const { aceptarPropuestaPublica, PropuestaError } = await import('./propuestas-repo')

beforeEach(() => {
  consultas.length = 0
})

async function firmar(nombre: string) {
  try {
    await firmarPorToken({ token: TOKEN, nombre, ip: '1.2.3.4', userAgent: 'jest' })
    return { ok: true as const, mensaje: '', status: 200 }
  } catch (e) {
    const err = e as Error & { status?: number }
    return { ok: false as const, mensaje: err.message, status: err.status ?? 500 }
  }
}

// Control positivo: sin él, el negativo podría estar cayendo porque el arnés no
// llega a montar una firma pendiente y no por el tope de largo.
describe('control · una firma normal sigue funcionando', () => {
  it('un nombre corriente firma y se escribe', async () => {
    const r = await firmar('Juan Pérez')
    expect(r.ok, r.mensaje).toBe(true)
    const upd = consultas.find((c) => /update contrato_firmas/i.test(c.texto))
    expect(upd?.params?.[1]).toBe('Juan Pérez')
  })

  it('un nombre legal largo de verdad cabe', async () => {
    const r = await firmar('María de los Ángeles Fernández de la Torre y Villaseñor Gutiérrez')
    expect(r.ok, r.mensaje).toBe(true)
  })

  it('sigue rechazando el nombre demasiado corto', async () => {
    const r = await firmar('Jo')
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
  })
})

describe('VAL-09 · la firma pública no acepta un nombre descomunal', () => {
  it('rechaza 5 000 caracteres con 400 y NO escribe la firma', async () => {
    const r = await firmar('X'.repeat(5000))
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
    expect(consultas.find((c) => /update contrato_firmas/i.test(c.texto))).toBeUndefined()
  })

  it('el borde exacto: 240 pasa, 241 no', async () => {
    expect((await firmar('X'.repeat(240))).ok).toBe(true)
    expect((await firmar('X'.repeat(241))).ok).toBe(false)
  })
})

// ─── La otra ruta pública: aceptar la propuesta desde la liga ────────────────
async function aceptar(nombre: string) {
  try {
    await aceptarPropuestaPublica('b'.repeat(64), { nombre, ip: '1.2.3.4' })
    return { ok: true as const, mensaje: '' }
  } catch (e) {
    return { ok: false as const, mensaje: (e as Error).message, esDeNegocio: e instanceof PropuestaError }
  }
}

describe('VAL-09 · aceptar la propuesta tampoco acepta un nombre descomunal', () => {
  it('rechaza 5 000 caracteres', async () => {
    const r = await aceptar('X'.repeat(5000))
    expect(r.ok).toBe(false)
    // Y cae por SU motivo, no por el token: la comprobación de largo es lo
    // primero que hace la función, antes de tocar la base.
    expect(r.mensaje).toContain('240')
  })

  it('sigue rechazando el vacío, y con su propio mensaje', async () => {
    const r = await aceptar('   ')
    expect(r.ok).toBe(false)
    expect(r.mensaje).toContain('Escribe tu nombre')
  })

  it('un nombre normal NO cae en el tope (llega a consultar el token)', async () => {
    // Con este arnés el token no resuelve a ninguna propuesta, así que devuelve
    // null sin lanzar: lo que se afirma es que no se rechazó por el largo.
    const r = await aceptar('María de los Ángeles Fernández de la Torre')
    expect(r.ok).toBe(true)
  })
})
