import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
const leer = vi.fn()
// La falla va por fuera de vi.fn: el espía de vitest 4 encadena la promesa
// rechazada que devuelve la implementación y deja un rechazo propio sin manejar.
let falla: Error | null = null
vi.mock('./vallas-publicas-repo', () => ({
  leerVallasDePropuestaPorToken: (t: string) => (falla ? Promise.reject(falla) : leer(t)),
}))

import { planoVallasDeLiga } from './vallas-publicas-controller'

// ============================================================================
//  LIGA + PLANO DE VALLAS (dueño, 20/11) · «si es valla, cómo se ven las
//  pantallas que rentará, si es más de 1; si solo es una, sin tema».
//  El controller decide (>1 valla activa) y arma la respuesta con LISTA
//  BLANCA, con ids OPACOS: la liga no expone ids de vallas ni de grupos.
// ============================================================================

const TOKEN = 'a'.repeat(48)
const S1 = '11111111-1111-4111-8111-111111111111'
const S2 = '22222222-2222-4222-8222-222222222222'
const UUID_V = (n: number) => `0000000${n}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`
const UUID_G = '99999999-9999-4999-8999-999999999999'

const valla = (n: number, extra: Record<string, unknown> = {}) => ({
  id: UUID_V(n),
  sitioId: S1,
  numero: `V-00${n}`,
  cara: null,
  ancho: 6,
  alto: 3,
  grupoId: null,
  posicion: null,
  dobla: null,
  ...extra,
})

describe('planoVallasDeLiga · decide y arma el plano de la liga', () => {
  beforeEach(() => leer.mockReset())

  it('NEGATIVO · un token con forma inválida no llega a la base', async () => {
    expect(await planoVallasDeLiga("x' or 1=1 --")).toBeNull()
    expect(await planoVallasDeLiga('')).toBeNull()
    expect(leer).not.toHaveBeenCalled()
  })

  it('token sin propuesta → null', async () => {
    leer.mockResolvedValue(null)
    expect(await planoVallasDeLiga(TOKEN)).toBeNull()
    expect(leer).toHaveBeenCalledWith(TOKEN)
  })

  it('0 vallas → null (la liga queda como siempre)', async () => {
    leer.mockResolvedValue({ sitios: [{ id: S1, nombre: 'Periférico' }], vallas: [], grupos: [] })
    expect(await planoVallasDeLiga(TOKEN)).toBeNull()
  })

  it('UNA sola valla → null: «si solo es una, sin tema»', async () => {
    leer.mockResolvedValue({ sitios: [{ id: S1, nombre: 'Periférico' }], vallas: [valla(1)], grupos: [] })
    expect(await planoVallasDeLiga(TOKEN)).toBeNull()
  })

  it('dos vallas, aunque sea en sitios distintos → el plano', async () => {
    leer.mockResolvedValue({
      sitios: [
        { id: S1, nombre: 'Periférico' },
        { id: S2, nombre: 'Insurgentes' },
      ],
      vallas: [valla(1), valla(2, { sitioId: S2 })],
      grupos: [],
    })
    const p = await planoVallasDeLiga(TOKEN)
    expect(p?.vallas.map((v) => v.numero)).toEqual(['V-001', 'V-002'])
    expect(p?.sitios).toEqual([
      { id: S1, nombre: 'Periférico' },
      { id: S2, nombre: 'Insurgentes' },
    ])
  })

  it('ids OPACOS para vallas y grupos (consistentes entre sí), sin uuid interno', async () => {
    leer.mockResolvedValue({
      sitios: [{ id: S1, nombre: 'Periférico' }],
      vallas: [
        valla(1, { grupoId: UUID_G, posicion: 1, cara: 1, dobla: 'derecha' }),
        valla(2, { grupoId: UUID_G, posicion: 2, cara: 1 }),
      ],
      grupos: [{ id: UUID_G, numero: 'G-001', nombre: 'Muro norte', modo: 'una_imagen', sigueFuera: true }],
    })
    const p = await planoVallasDeLiga(TOKEN)
    expect(p).not.toBeNull()
    const texto = JSON.stringify(p)
    expect(texto).not.toContain(UUID_G)
    expect(texto).not.toContain(UUID_V(1))
    expect(p!.grupos).toEqual([{ id: 'g1', numero: 'G-001', nombre: 'Muro norte', modo: 'una_imagen', sigueFuera: true }])
    expect(p!.vallas[0]).toEqual({
      id: 'v1',
      sitioId: S1,
      numero: 'V-001',
      cara: 1,
      ancho: 6,
      alto: 3,
      grupoId: 'g1',
      posicion: 1,
      dobla: 'derecha',
    })
    expect(p!.vallas[1].grupoId).toBe('g1')
  })

  it('LISTA BLANCA · un campo que se colara en la fila (notas, tenant, marca) no llega', async () => {
    leer.mockResolvedValue({
      sitios: [{ id: S1, nombre: 'Periférico', tenantId: 'T-SECRETO', renta: 20000 }],
      vallas: [valla(1, { notas: 'NOTA-SECRETA', tenantId: 'T-SECRETO', marca: 'Pepsi' }), valla(2)],
      grupos: [],
    })
    const texto = JSON.stringify(await planoVallasDeLiga(TOKEN))
    expect(texto).not.toMatch(/NOTA-SECRETA|T-SECRETO|Pepsi|20000|notas|tenant|marca|renta/)
  })

  it('un grupo sin vallas en la propuesta no se manda', async () => {
    leer.mockResolvedValue({
      sitios: [{ id: S1, nombre: 'Periférico' }],
      vallas: [valla(1), valla(2)],
      grupos: [{ id: UUID_G, numero: 'G-AJENO', nombre: null, modo: 'separadas', sigueFuera: false }],
    })
    const p = await planoVallasDeLiga(TOKEN)
    expect(p!.grupos).toEqual([])
    expect(JSON.stringify(p)).not.toContain('G-AJENO')
  })

  it('si la lectura falla, la liga no se cae: null', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    falla = new Error('relation "vallas" does not exist')
    try {
      expect(await planoVallasDeLiga(TOKEN)).toBeNull()
      expect(err).toHaveBeenCalled()
    } finally {
      falla = null
      err.mockRestore()
    }
  })
})
