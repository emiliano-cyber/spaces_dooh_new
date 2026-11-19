import { describe, it, expect } from 'vitest'
import {
  normalizarNumero,
  siguienteNumero,
  medidaParaArte,
  medidaSugeridaDeGrupo,
  problemasDeGrupo,
} from './numeracion'
import type { Valla, GrupoVallas } from './tipos'

// ============================================================================
//  VALLAS · numeración y agrupación (pura). Dos numeraciones: una por cuadro y
//  una por grupo; si el grupo es «una sola imagen», la medida que cuenta para
//  el arte es la del grupo.
// ============================================================================

const valla = (o: Partial<Valla> & { id: string }): Valla => ({
  sitioId: 's1',
  numero: o.id.toUpperCase(),
  cara: null,
  ancho: 4,
  alto: 3,
  grupoId: null,
  posicion: null,
  notas: null,
  activo: true,
  ...o,
})

const grupo = (o: Partial<GrupoVallas> & { id: string }): GrupoVallas => ({
  numero: 'G-001',
  nombre: null,
  modo: 'una_imagen',
  ancho: null,
  alto: null,
  notas: null,
  activo: true,
  ...o,
})

describe('normalizarNumero', () => {
  it('recorta, colapsa espacios y pasa a mayúsculas', () => {
    expect(normalizarNumero('  v-  12 ')).toBe('V- 12')
    expect(normalizarNumero('g-001')).toBe('G-001')
  })
})

describe('siguienteNumero', () => {
  it('sin existentes empieza en 001 con el prefijo', () => {
    expect(siguienteNumero([], 'V-')).toBe('V-001')
  })
  it('toma el mayor con ese prefijo y suma uno, sin importar huecos ni orden', () => {
    expect(siguienteNumero(['V-003', 'V-001', 'v-010', 'G-050', 'otro'], 'V-')).toBe('V-011')
  })
  it('respeta el ancho si el número ya es más largo', () => {
    expect(siguienteNumero(['V-999'], 'V-')).toBe('V-1000')
  })
})

describe('medidaParaArte', () => {
  it('valla suelta: su propia medida', () => {
    expect(medidaParaArte(valla({ id: 'a', ancho: 6, alto: 3 }), null)).toEqual({ ancho: 6, alto: 3, origen: 'valla' })
  })
  it('grupo SEPARADAS: cada valla lleva su arte con su medida', () => {
    const g = grupo({ id: 'g', modo: 'separadas', ancho: 12, alto: 3 })
    expect(medidaParaArte(valla({ id: 'a', grupoId: 'g', ancho: 6, alto: 3 }), g)).toEqual({ ancho: 6, alto: 3, origen: 'valla' })
  })
  it('grupo UNA IMAGEN con medida: cuenta la del grupo', () => {
    const g = grupo({ id: 'g', modo: 'una_imagen', ancho: 12, alto: 3 })
    expect(medidaParaArte(valla({ id: 'a', grupoId: 'g', ancho: 6, alto: 3 }), g)).toEqual({ ancho: 12, alto: 3, origen: 'grupo' })
  })
  it('grupo UNA IMAGEN sin medida capturada: null (no se adivina)', () => {
    const g = grupo({ id: 'g', modo: 'una_imagen' })
    expect(medidaParaArte(valla({ id: 'a', grupoId: 'g' }), g)).toBeNull()
  })
  it('un grupo que no es el de la valla se ignora', () => {
    const g = grupo({ id: 'otro', modo: 'una_imagen', ancho: 12, alto: 3 })
    expect(medidaParaArte(valla({ id: 'a', grupoId: 'g', ancho: 6, alto: 3 }), g)?.origen).toBe('valla')
  })
})

describe('medidaSugeridaDeGrupo', () => {
  it('lado a lado: suma de anchos y el mayor alto', () => {
    expect(medidaSugeridaDeGrupo([valla({ id: 'a', ancho: 6, alto: 3 }), valla({ id: 'b', ancho: 4.5, alto: 3.2 })])).toEqual({
      ancho: 10.5,
      alto: 3.2,
    })
  })
  it('sin vallas: null', () => {
    expect(medidaSugeridaDeGrupo([])).toBeNull()
  })
})

describe('problemasDeGrupo', () => {
  it('una imagen sin medida y con menos de dos vallas: dos avisos', () => {
    const p = problemasDeGrupo(grupo({ id: 'g', modo: 'una_imagen' }), [valla({ id: 'a', grupoId: 'g' })])
    expect(p.map((x) => x.codigo).sort()).toEqual(['grupo-sin-medida', 'grupo-una-valla'])
  })
  it('vallas de sitios distintos: aviso', () => {
    const p = problemasDeGrupo(grupo({ id: 'g', modo: 'separadas' }), [
      valla({ id: 'a', grupoId: 'g', sitioId: 's1' }),
      valla({ id: 'b', grupoId: 'g', sitioId: 's2' }),
    ])
    expect(p.map((x) => x.codigo)).toEqual(['grupo-varios-sitios'])
  })
  it('un grupo bien formado no tiene problemas', () => {
    const p = problemasDeGrupo(grupo({ id: 'g', modo: 'una_imagen', ancho: 12, alto: 3 }), [
      valla({ id: 'a', grupoId: 'g' }),
      valla({ id: 'b', grupoId: 'g' }),
    ])
    expect(p).toEqual([])
  })
})
