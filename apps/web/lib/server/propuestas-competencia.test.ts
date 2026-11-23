import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ContextoVallas } from '@/lib/vallas/reglas/tipos'

// ============================================================================
//  PROP-MARCA (20/11) · la competencia de marcas AL CREAR LA PROPUESTA.
// ----------------------------------------------------------------------------
//  Pedido del dueño: «la validación de la competencia también debe estar al
//  crear la propuesta, con las lógicas que ya están dentro». Lo que se mide:
//
//   · la propuesta usa la MISMA regla (`evaluarReglas` real, aquí sin simular)
//     sobre el MISMO contexto (`contextoParaVerificar`, simulado: lee la base);
//   · marca vacía → cuenta el nombre del cliente, como en campañas;
//   · SOLO AVISA: nivel 'aviso' siempre, y si algo revienta, cero avisos y
//     ningún error — un aviso nunca puede impedir guardar una propuesta;
//   · el aviso no lleva el id ni el nombre de la campaña rival (quien crea
//     propuestas no necesariamente ve las campañas de los demás): marca,
//     categoría, sitio y fechas, y nada más.
//
//  La base se simula entera: `vallas-repo` y `propuestas-competencia-repo`
//  arrastran `tenant.ts`, que llama a `cache()` de React fuera de Next. Lo que
//  toca la base de verdad lo mide `propuesta-competencia.e2e.test.ts`.
// ============================================================================

const S1 = '11111111-1111-4111-8111-111111111111'
const S2 = '22222222-2222-4222-8222-222222222222'
const V1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const V2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const CLI = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const CAMP = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

const { contextoMock, nombreClienteMock, nombresSitiosMock, datosPropuestaMock } = vi.hoisted(() => ({
  contextoMock: vi.fn(),
  nombreClienteMock: vi.fn(),
  nombresSitiosMock: vi.fn(),
  datosPropuestaMock: vi.fn(),
}))

vi.mock('./vallas-repo', () => ({
  contextoParaVerificar: (c: unknown) => contextoMock(c),
  crearValla: vi.fn(),
  actualizarValla: vi.fn(),
  borrarValla: vi.fn(),
  crearGrupo: vi.fn(),
  actualizarGrupo: vi.fn(),
  borrarGrupo: vi.fn(),
  crearCategoria: vi.fn(),
  actualizarCategoria: vi.fn(),
  VallaError: class VallaError extends Error {},
  VALLA_NO_ENCONTRADA: 'x',
  GRUPO_NO_ENCONTRADO: 'x',
  CATEGORIA_NO_ENCONTRADA: 'x',
}))
vi.mock('./propuestas-competencia-repo', () => ({
  nombreDeCliente: (id: string) => nombreClienteMock(id),
  nombresDeSitios: (ids: string[]) => nombresSitiosMock(ids),
  datosCompetenciaDePropuesta: (id: string) => datosPropuestaMock(id),
}))

import { avisosCompetencia, avisosDePropuesta, avisosCompetenciaCtrl } from './propuestas-competencia'
import { verificarCompetencia, verificarVallasCtrl } from './vallas-controller'

/** Un contexto como el que arma `contextoParaVerificar`: Coca-Cola reservada en S1. */
function contexto(c: { marca: string; inicio: string; fin: string; sitioIds?: string[]; excluirCampanaId?: string | null }): ContextoVallas {
  const vallas = [
    { id: V1, sitioId: S1, numero: 'V-1', cara: 1, ancho: 12, alto: 3, grupoId: null, posicion: null, notas: null, activo: true },
    { id: V2, sitioId: S2, numero: 'V-2', cara: 1, ancho: 12, alto: 3, grupoId: null, posicion: null, notas: null, activo: true },
  ]
  const pedidos = new Set(c.sitioIds ?? [])
  return {
    vallas,
    grupos: [],
    categorias: [{ id: 'k', nombre: 'Refrescos de cola', marcas: ['Coca-Cola', 'Pepsi'], activo: true }],
    ocupaciones: [
      { vallaId: V1, marca: 'Coca-Cola', inicio: '2026-12-01', fin: '2026-12-15', campanaId: CAMP, campanaNombre: 'Navidad Coca' },
    ],
    candidata: {
      marca: c.marca,
      inicio: c.inicio,
      fin: c.fin,
      vallaIds: vallas.filter((v) => pedidos.has(v.sitioId)).map((v) => v.id),
      excluirCampanaId: c.excluirCampanaId ?? null,
    },
  }
}

beforeEach(() => {
  contextoMock.mockReset().mockImplementation(async (c: any) => contexto(c))
  nombreClienteMock.mockReset().mockResolvedValue('Pepsi')
  nombresSitiosMock.mockReset().mockImplementation(async (ids: string[]) =>
    new Map(ids.map((id) => [id, id === S1 ? 'Periférico Sur' : 'Insurgentes'])),
  )
  datosPropuestaMock.mockReset()
})

const BASE = { fechaInicio: '2026-12-01', fechaFin: '2026-12-15', sitioIds: [S1] }

describe('verificarCompetencia · la función que comparten Vallas y Propuestas', () => {
  it('arma el contexto con contextoParaVerificar y corre las reglas reales', async () => {
    const r = await verificarCompetencia({ marca: 'Pepsi', fechaInicio: '2026-12-01', fechaFin: '2026-12-15', sitioIds: [S1] })
    expect(contextoMock).toHaveBeenCalledWith(
      expect.objectContaining({ marca: 'Pepsi', inicio: '2026-12-01', fin: '2026-12-15', sitioIds: [S1] }),
    )
    expect(r.bloquea).toBe(false)
    expect(r.hallazgos).toHaveLength(1)
    expect(r.hallazgos[0]).toMatchObject({ regla: 'competencia-marcas', nivel: 'aviso' })
  })

  it('POST /api/vallas/verificar sigue devolviendo exactamente { hallazgos, bloquea }', async () => {
    const r = await verificarVallasCtrl({ marca: 'Pepsi', fechaInicio: '2026-12-01', fechaFin: '2026-12-15', sitioIds: [S1] })
    expect(Object.keys(r).sort()).toEqual(['bloquea', 'hallazgos'])
    expect(r.hallazgos).toHaveLength(1)
  })
})

describe('avisosCompetencia · la propuesta', () => {
  it('Pepsi en el sitio de una campaña de Coca-Cola, mismas fechas → UN aviso, con sitio y fechas', async () => {
    const a = await avisosCompetencia({ ...BASE, marca: 'Pepsi' })
    expect(a).toEqual([
      {
        regla: 'competencia-marcas',
        nivel: 'aviso',
        marca: 'Pepsi',
        marcaExistente: 'Coca-Cola',
        categoria: 'Refrescos de cola',
        sitioId: S1,
        sitioNombre: 'Periférico Sur',
        inicio: '2026-12-01',
        fin: '2026-12-15',
        mensaje: 'Pepsi compite con Coca-Cola (Refrescos de cola) en Periférico Sur del 2026-12-01 al 2026-12-15',
      },
    ])
  })

  it('NO expone la campaña rival: ni su id ni su nombre', async () => {
    const a = await avisosCompetencia({ ...BASE, marca: 'Pepsi' })
    expect(JSON.stringify(a)).not.toContain(CAMP)
    expect(JSON.stringify(a)).not.toContain('Navidad Coca')
  })

  it('marca vacía o en blanco → cuenta el NOMBRE DEL CLIENTE', async () => {
    const a = await avisosCompetencia({ ...BASE, marca: '   ', clienteId: CLI })
    expect(nombreClienteMock).toHaveBeenCalledWith(CLI)
    expect(contextoMock).toHaveBeenCalledWith(expect.objectContaining({ marca: 'Pepsi' }))
    expect(a).toHaveLength(1)
  })

  it('la marca escrita MANDA sobre el cliente', async () => {
    nombreClienteMock.mockResolvedValue('Coca-Cola')
    const a = await avisosCompetencia({ ...BASE, marca: 'Pepsi', clienteId: CLI })
    expect(nombreClienteMock).not.toHaveBeenCalled()
    expect(a).toHaveLength(1)
  })

  it('sin marca y sin cliente → cero avisos y ni siquiera se lee la base', async () => {
    expect(await avisosCompetencia({ ...BASE, marca: null })).toEqual([])
    expect(contextoMock).not.toHaveBeenCalled()
  })

  it('sin sitios → cero avisos, sin leer la base', async () => {
    expect(await avisosCompetencia({ ...BASE, sitioIds: [], marca: 'Pepsi' })).toEqual([])
    expect(contextoMock).not.toHaveBeenCalled()
  })

  it('otro sitio, otras fechas o la misma marca → nada', async () => {
    expect(await avisosCompetencia({ ...BASE, sitioIds: [S2], marca: 'Pepsi' })).toEqual([])
    expect(await avisosCompetencia({ ...BASE, fechaInicio: '2026-12-16', fechaFin: '2026-12-31', marca: 'Pepsi' })).toEqual([])
    expect(await avisosCompetencia({ ...BASE, marca: 'coca cola' })).toEqual([])
  })

  it('SOLO AVISA: si leer la base revienta, cero avisos y NINGÚN error', async () => {
    contextoMock.mockRejectedValue(new Error('se cayó la base'))
    await expect(avisosCompetencia({ ...BASE, marca: 'Pepsi' })).resolves.toEqual([])
  })

  it('SOLO AVISA: todo lo que sale lleva nivel aviso', async () => {
    const a = await avisosCompetencia({ ...BASE, marca: 'Pepsi' })
    expect(a.every((x) => x.nivel === 'aviso')).toBe(true)
  })
})

describe('avisosDePropuesta · una propuesta ya guardada', () => {
  it('lee marca (ya con el cliente de respaldo), periodo, sitios y su campaña, y excluye esa campaña', async () => {
    datosPropuestaMock.mockResolvedValue({
      marca: 'Pepsi', fechaInicio: '2026-12-01', fechaFin: '2026-12-15', sitioIds: [S1], campanaId: 'otra',
    })
    const a = await avisosDePropuesta('P1')
    expect(datosPropuestaMock).toHaveBeenCalledWith('P1')
    expect(contextoMock).toHaveBeenCalledWith(expect.objectContaining({ marca: 'Pepsi', excluirCampanaId: 'otra' }))
    expect(a).toHaveLength(1)
  })

  it('una propuesta que no existe (o es de otra organización) → cero avisos', async () => {
    datosPropuestaMock.mockResolvedValue(null)
    expect(await avisosDePropuesta('P1')).toEqual([])
    expect(contextoMock).not.toHaveBeenCalled()
  })

  it('si la lectura revienta → cero avisos, nunca un error', async () => {
    datosPropuestaMock.mockRejectedValue(new Error('boom'))
    await expect(avisosDePropuesta('P1')).resolves.toEqual([])
  })
})

describe('avisosCompetenciaCtrl · la vista previa de la pantalla', () => {
  it('valida la forma: fechas AAAA-MM-DD, ids uuid y fin ≥ inicio (400)', async () => {
    await expect(avisosCompetenciaCtrl({ ...BASE, fechaInicio: 'ayer' })).rejects.toMatchObject({ status: 400 })
    await expect(avisosCompetenciaCtrl({ ...BASE, sitioIds: ['no-uuid'] })).rejects.toMatchObject({ status: 400 })
    await expect(avisosCompetenciaCtrl({ ...BASE, clienteId: 'x' })).rejects.toMatchObject({ status: 400 })
    await expect(avisosCompetenciaCtrl({ ...BASE, fechaInicio: '2026-12-20' })).rejects.toMatchObject({ status: 400 })
    await expect(avisosCompetenciaCtrl({ ...BASE, marca: 'x'.repeat(121) })).rejects.toMatchObject({ status: 400 })
  })

  it('devuelve { avisosCompetencia }', async () => {
    const r = await avisosCompetenciaCtrl({ ...BASE, marca: 'Pepsi' })
    expect(r.avisosCompetencia).toHaveLength(1)
  })
})
