import { describe, it, expect } from 'vitest'
import { normalizarMarca, seSolapan, crearReglaCompetencia } from './competencia-marcas'
import { evaluarReglas, REGLAS } from './index'
import { CONFIG_POR_OMISION } from './configuracion'
import type { ContextoVallas, Regla } from './tipos'
import type { Valla, GrupoVallas } from '../tipos'

// ============================================================================
//  VALLAS · reglas de negocio. La primera: exclusión de competencia de marcas
//  (Coca-Cola y Pepsi no van en la misma valla, ni en el mismo grupo que forma
//  una sola imagen, con fechas que se solapan). En el esqueleto es AVISO.
// ============================================================================

const valla = (id: string, o: Partial<Valla> = {}): Valla => ({
  id,
  sitioId: 's1',
  numero: id,
  cara: null,
  ancho: 4,
  alto: 3,
  grupoId: null,
  posicion: null,
  notas: null,
  activo: true,
  ...o,
})
const grupo = (id: string, modo: GrupoVallas['modo']): GrupoVallas => ({
  id,
  numero: id,
  nombre: null,
  modo,
  ancho: 12,
  alto: 3,
  notas: null,
  activo: true,
})

const CATEGORIAS = [
  { id: 'c1', nombre: 'Refrescos de cola', marcas: ['Coca-Cola', 'Pepsi'], activo: true },
  { id: 'c2', nombre: 'Tiendas departamentales', marcas: ['El Palacio de Hierro', 'Liverpool'], activo: true },
]

function ctx(o: Partial<ContextoVallas> = {}): ContextoVallas {
  return {
    vallas: [valla('A'), valla('B'), valla('C', { sitioId: 's2' })],
    grupos: [],
    categorias: CATEGORIAS,
    ocupaciones: [{ vallaId: 'A', marca: 'Pepsi', inicio: '2026-12-01', fin: '2026-12-31', campanaId: 'k1', campanaNombre: 'Pepsi Navidad' }],
    candidata: { marca: 'Coca-Cola', inicio: '2026-12-15', fin: '2027-01-15', vallaIds: ['A'] },
    ...o,
  }
}

const competencia = (o = {}) => crearReglaCompetencia({ ...CONFIG_POR_OMISION.competencia, ...o })

describe('normalizarMarca y seSolapan', () => {
  it('ignora mayúsculas, acentos, espacios y guiones', () => {
    expect(normalizarMarca(' Coca-Cola ')).toBe(normalizarMarca('coca cola'))
    expect(normalizarMarca('Pépsi')).toBe('pepsi')
  })
  it('fechas inclusivas: tocarse en un día ya es solape', () => {
    expect(seSolapan({ inicio: '2026-12-01', fin: '2026-12-10' }, { inicio: '2026-12-10', fin: '2026-12-20' })).toBe(true)
    expect(seSolapan({ inicio: '2026-12-01', fin: '2026-12-09' }, { inicio: '2026-12-10', fin: '2026-12-20' })).toBe(false)
  })
})

describe('competencia de marcas', () => {
  it('misma valla, marcas que compiten y fechas que se solapan → aviso', () => {
    const h = competencia().evaluar(ctx())
    expect(h).toHaveLength(1)
    expect(h[0]).toMatchObject({ regla: 'competencia-marcas', nivel: 'aviso', datos: { vallaId: 'A', marcaExistente: 'Pepsi', categoria: 'Refrescos de cola', campanaId: 'k1' } })
    expect(h[0].mensaje).toContain('Pepsi')
  })

  it('el nivel es configurable: bloqueo', () => {
    expect(competencia({ nivel: 'bloqueo' }).evaluar(ctx())[0].nivel).toBe('bloqueo')
  })

  it('sin solape de fechas no hay choque', () => {
    expect(competencia().evaluar(ctx({ candidata: { marca: 'Coca-Cola', inicio: '2027-01-01', fin: '2027-01-31', vallaIds: ['A'] } }))).toEqual([])
  })

  it('marcas de categorías distintas no chocan (Coca-Cola junto a Liverpool)', () => {
    const c = ctx({ ocupaciones: [{ vallaId: 'A', marca: 'Liverpool', inicio: '2026-12-01', fin: '2026-12-31', campanaId: 'k2', campanaNombre: 'Liverpool' }] })
    expect(competencia().evaluar(c)).toEqual([])
  })

  it('la misma marca no compite consigo misma', () => {
    const c = ctx({ ocupaciones: [{ vallaId: 'A', marca: 'coca cola', inicio: '2026-12-01', fin: '2026-12-31', campanaId: 'k3', campanaNombre: 'Otra de Coca' }] })
    expect(competencia().evaluar(c)).toEqual([])
  })

  it('una marca fuera del catálogo no compite con nadie', () => {
    expect(competencia().evaluar(ctx({ candidata: { marca: 'Bimbo', inicio: '2026-12-15', fin: '2027-01-15', vallaIds: ['A'] } }))).toEqual([])
  })

  it('una categoría dada de baja no cuenta', () => {
    expect(competencia().evaluar(ctx({ categorias: CATEGORIAS.map((c) => ({ ...c, activo: false })) }))).toEqual([])
  })

  it('valla distinta, sin grupo: no hay choque', () => {
    expect(competencia().evaluar(ctx({ candidata: { marca: 'Coca-Cola', inicio: '2026-12-15', fin: '2027-01-15', vallaIds: ['B'] } }))).toEqual([])
  })

  it('mismo grupo UNA IMAGEN: Coca en B choca con Pepsi en A', () => {
    const c = ctx({
      vallas: [valla('A', { grupoId: 'G' }), valla('B', { grupoId: 'G' })],
      grupos: [grupo('G', 'una_imagen')],
      candidata: { marca: 'Coca-Cola', inicio: '2026-12-15', fin: '2027-01-15', vallaIds: ['B'] },
    })
    const h = competencia().evaluar(c)
    expect(h).toHaveLength(1)
    expect(h[0].datos).toMatchObject({ vallaId: 'B', vallaOcupada: 'A', grupoId: 'G' })
  })

  it('mismo grupo SEPARADAS: con el alcance por omisión no choca; con alcance «grupo» sí', () => {
    const c = ctx({
      vallas: [valla('A', { grupoId: 'G' }), valla('B', { grupoId: 'G' })],
      grupos: [grupo('G', 'separadas')],
      candidata: { marca: 'Coca-Cola', inicio: '2026-12-15', fin: '2027-01-15', vallaIds: ['B'] },
    })
    expect(competencia().evaluar(c)).toEqual([])
    expect(competencia({ alcance: 'grupo' }).evaluar(c)).toHaveLength(1)
  })

  it('alcance «sitio»: cualquier valla del mismo sitio cuenta, otro sitio no', () => {
    const enB = ctx({ candidata: { marca: 'Coca-Cola', inicio: '2026-12-15', fin: '2027-01-15', vallaIds: ['B'] } })
    expect(competencia({ alcance: 'sitio' }).evaluar(enB)).toHaveLength(1)
    const enC = ctx({ candidata: { marca: 'Coca-Cola', inicio: '2026-12-15', fin: '2027-01-15', vallaIds: ['C'] } })
    expect(competencia({ alcance: 'sitio' }).evaluar(enC)).toEqual([])
  })

  it('una ocupación de la MISMA campaña que se está verificando no cuenta (excluirCampanaId)', () => {
    const c = ctx({ candidata: { marca: 'Coca-Cola', inicio: '2026-12-15', fin: '2027-01-15', vallaIds: ['A'], excluirCampanaId: 'k1' } })
    expect(competencia().evaluar(c)).toEqual([])
  })

  it('no repite el mismo choque si la candidata trae la valla dos veces', () => {
    const c = ctx({ candidata: { marca: 'Coca-Cola', inicio: '2026-12-15', fin: '2027-01-15', vallaIds: ['A', 'A'] } })
    expect(competencia().evaluar(c)).toHaveLength(1)
  })
})

describe('evaluarReglas', () => {
  it('corre todas las reglas registradas y junta lo que encuentran', () => {
    const r = evaluarReglas(ctx())
    expect(r.hallazgos.map((h) => h.regla)).toEqual(['competencia-marcas'])
    expect(r.bloquea).toBe(false)
  })

  it('bloquea si alguna regla devuelve un bloqueo', () => {
    const siempre: Regla = { id: 'prueba', descripcion: 'x', evaluar: () => [{ regla: 'prueba', nivel: 'bloqueo', mensaje: 'no' }] }
    const r = evaluarReglas(ctx(), [...REGLAS, siempre])
    expect(r.bloquea).toBe(true)
    expect(r.hallazgos.map((h) => h.regla)).toEqual(['competencia-marcas', 'prueba'])
  })

  it('una regla que revienta no tumba a las demás: se convierte en aviso', () => {
    const rota: Regla = { id: 'rota', descripcion: 'x', evaluar: () => { throw new Error('boom') } }
    const r = evaluarReglas(ctx(), [rota, ...REGLAS])
    expect(r.hallazgos.map((h) => [h.regla, h.nivel])).toEqual([['rota', 'aviso'], ['competencia-marcas', 'aviso']])
  })

  it('el registro tiene ids únicos', () => {
    const ids = REGLAS.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
