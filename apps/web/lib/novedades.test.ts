import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  TIPOS_NOVEDAD,
  ETIQUETA_TIPO,
  validarNovedades,
  entradaValida,
  notasDe,
  versionBase,
  agruparPorTipo,
  versionInstaladaDe,
  debeMostrarNovedades,
  marcarVista,
  leerVistas,
  claveVistas,
  type EntradaNovedades,
} from './novedades'

// ============================================================================
//  Las notas de version (pedido del dueno, 2026-10-01). Lo que se prueba aqui
//  es lo que decide si un archivo de notas es VALIDO y cuando se ensena el
//  dialogo. Los casos NEGATIVOS son el corazon: un archivo de notas roto no
//  puede llegar a una release (lo para `scripts/verificar-novedades.mjs`), y
//  el dialogo no puede salir donde no hay nada que contar.
// ============================================================================

const BUENA: EntradaNovedades = {
  version: 'v0.9.2',
  fecha: '2026-10-01',
  items: [
    { tipo: 'NUEVO', texto: 'Cada version nueva trae sus notas.' },
    { tipo: 'CORREGIDO', texto: 'Un arreglo.' },
  ],
}
const VIEJA: EntradaNovedades = {
  version: 'v0.9.1',
  fecha: '2026-09-30',
  items: [{ tipo: 'AJUSTADO', texto: 'Un ajuste.' }],
}

function errores(datos: unknown): string[] {
  const r = validarNovedades(datos)
  return r.ok ? [] : r.errores
}

describe('validarNovedades', () => {
  it('acepta una lista bien formada, de la mas nueva a la mas vieja', () => {
    const r = validarNovedades([BUENA, VIEJA])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.novedades.map((e) => e.version)).toEqual(['v0.9.2', 'v0.9.1'])
  })

  it('acepta la lista vacia: no hay notas que validar', () => {
    expect(validarNovedades([]).ok).toBe(true)
  })

  it('los tres tipos son exactamente estos, con su etiqueta', () => {
    expect([...TIPOS_NOVEDAD]).toEqual(['NUEVO', 'AJUSTADO', 'CORREGIDO'])
    expect(ETIQUETA_TIPO).toEqual({ NUEVO: 'Nuevo', AJUSTADO: 'Ajustado', CORREGIDO: 'Corregido' })
  })

  it('NEGATIVO: lo que no es una lista no vale', () => {
    expect(errores({ version: 'v0.9.2' })[0]).toMatch(/lista/)
    expect(errores(null)[0]).toMatch(/lista/)
  })

  it('NEGATIVO: una version que no es vX.Y.Z no vale', () => {
    for (const v of ['0.9.2', 'v0.9', 'v0.9.2-rc1', 'V0.9.2', 'v0.9.2 ', '', 9]) {
      expect(errores([{ ...BUENA, version: v }]).join(' ')).toMatch(/version/i)
    }
  })

  it('NEGATIVO: una fecha que no es AAAA-MM-DD real no vale', () => {
    for (const f of ['2026-10-1', '01/10/2026', '2026-02-30', '2026-13-01', '', null]) {
      expect(errores([{ ...BUENA, fecha: f }]).join(' ')).toMatch(/fecha/i)
    }
  })

  it('NEGATIVO: un tipo fuera de los tres no vale', () => {
    for (const t of ['nuevo', 'ELIMINADO', 'FIX', '', undefined]) {
      expect(errores([{ ...BUENA, items: [{ tipo: t, texto: 'x' }] }]).join(' ')).toMatch(/tipo/i)
    }
  })

  it('NEGATIVO: un texto vacio, o solo espacios, no vale', () => {
    for (const texto of ['', '   ', null, 3]) {
      expect(errores([{ ...BUENA, items: [{ tipo: 'NUEVO', texto }] }]).join(' ')).toMatch(/texto/i)
    }
  })

  it('NEGATIVO: una version sin ningun item no vale -- seria una entrada que no dice nada', () => {
    expect(errores([{ ...BUENA, items: [] }]).join(' ')).toMatch(/item/i)
    expect(errores([{ ...BUENA, items: 'x' }]).join(' ')).toMatch(/item/i)
  })

  it('NEGATIVO: un campo de mas (un typo) no se ignora en silencio', () => {
    expect(errores([{ ...BUENA, fehca: '2026-10-01' }]).join(' ')).toMatch(/fehca/)
    expect(
      errores([{ ...BUENA, items: [{ tipo: 'NUEVO', texto: 'x', tipe: 'NUEVO' }] }]).join(' '),
    ).toMatch(/tipe/)
  })

  it('NEGATIVO: una version repetida no vale', () => {
    expect(errores([BUENA, { ...BUENA, fecha: '2026-09-01' }]).join(' ')).toMatch(/repetida/i)
  })

  it('NEGATIVO: fuera de orden (la mas vieja primero) no vale', () => {
    expect(errores([VIEJA, BUENA]).join(' ')).toMatch(/orden/i)
  })

  it('el orden compara NUMEROS, no texto: v0.10.0 va antes que v0.9.2', () => {
    expect(validarNovedades([{ ...BUENA, version: 'v0.10.0' }, BUENA]).ok).toBe(true)
    expect(validarNovedades([BUENA, { ...BUENA, version: 'v0.10.0' }]).ok).toBe(false)
  })

  it('junta TODOS los errores, no solo el primero', () => {
    expect(errores([{ version: 'x', fecha: 'y', items: [{ tipo: 'z', texto: '' }] }]).length).toBeGreaterThanOrEqual(4)
  })
})

describe('versionBase y notasDe', () => {
  it('una precandidata se resuelve a su version: v0.9.2-rc1 trae las notas de v0.9.2', () => {
    expect(versionBase('v0.9.2')).toBe('v0.9.2')
    expect(versionBase('v0.9.2-rc1')).toBe('v0.9.2')
    expect(notasDe('v0.9.2-rc1', [BUENA, VIEJA])).toEqual(BUENA)
  })

  it('NEGATIVO: lo que no parece una version no resuelve a nada', () => {
    for (const v of ['desconocida', 'estable', '', null, undefined, '0.9.2']) {
      expect(versionBase(v)).toBeNull()
      expect(notasDe(v, [BUENA])).toBeNull()
    }
  })

  it('NEGATIVO: una version sin entrada no tiene notas', () => {
    expect(notasDe('v0.9.3', [BUENA, VIEJA])).toBeNull()
  })
})

describe('entradaValida (lo que escribio el actualizador en notas_disponibles)', () => {
  it('devuelve la entrada si es valida y es de la version pedida', () => {
    expect(entradaValida(BUENA, 'v0.9.2')).toEqual(BUENA)
  })

  it('NEGATIVO: una entrada invalida es null, no un 500', () => {
    expect(entradaValida({ ...BUENA, items: [{ tipo: 'OTRO', texto: 'x' }] }, 'v0.9.2')).toBeNull()
    expect(entradaValida('no soy json', 'v0.9.2')).toBeNull()
    expect(entradaValida(null, 'v0.9.2')).toBeNull()
  })

  it('NEGATIVO: unas notas de OTRA version no se ensenan como si fueran de esta', () => {
    expect(entradaValida(BUENA, 'v0.9.3')).toBeNull()
  })
})

describe('agruparPorTipo', () => {
  it('agrupa en el orden fijo Nuevo, Ajustado, Corregido, y se salta los grupos vacios', () => {
    const g = agruparPorTipo([
      { tipo: 'CORREGIDO', texto: 'c1' },
      { tipo: 'NUEVO', texto: 'n1' },
      { tipo: 'CORREGIDO', texto: 'c2' },
    ])
    expect(g).toEqual([
      { tipo: 'NUEVO', etiqueta: 'Nuevo', textos: ['n1'] },
      { tipo: 'CORREGIDO', etiqueta: 'Corregido', textos: ['c1', 'c2'] },
    ])
  })
})

describe('cuando se ensena el dialogo de novedades', () => {
  it('versionInstaladaDe: en produccion, la version sellada en la imagen', () => {
    expect(versionInstaladaDe('v0.9.2', 'production')).toBe('v0.9.2')
    expect(versionInstaladaDe('v0.9.2-rc1', 'production')).toBe('v0.9.2-rc1')
  })

  it('NEGATIVO: en desarrollo, o sin version, NO hay version instalada', () => {
    expect(versionInstaladaDe('v0.9.2', 'development')).toBeNull()
    expect(versionInstaladaDe(undefined, 'production')).toBeNull()
    expect(versionInstaladaDe('', 'production')).toBeNull()
    // El valor por omision del Dockerfile (`ARG VERSION=desconocida`).
    expect(versionInstaladaDe('desconocida', 'production')).toBeNull()
  })

  it('se ensena una vez: si hay notas y el usuario no las ha visto', () => {
    expect(debeMostrarNovedades({ notas: BUENA, vistas: [] })).toBe(true)
    expect(debeMostrarNovedades({ notas: BUENA, vistas: ['v0.9.1'] })).toBe(true)
  })

  it('NEGATIVO: ya vistas, no se vuelven a ensenar', () => {
    expect(debeMostrarNovedades({ notas: BUENA, vistas: ['v0.9.2'] })).toBe(false)
  })

  it('NEGATIVO: una version sin notas nunca ensena el dialogo', () => {
    expect(debeMostrarNovedades({ notas: null, vistas: [] })).toBe(false)
  })

  it('marcarVista anade la version sin repetirla, y la lista no crece sin limite', () => {
    expect(marcarVista([], 'v0.9.2')).toEqual(['v0.9.2'])
    expect(marcarVista(['v0.9.2'], 'v0.9.2')).toEqual(['v0.9.2'])
    const muchas = Array.from({ length: 40 }, (_, i) => `v0.0.${i}`)
    const r = marcarVista(muchas, 'v1.0.0')
    expect(r.length).toBeLessThanOrEqual(20)
    expect(r[r.length - 1]).toBe('v1.0.0')
  })

  it('leerVistas tolera lo que haya en localStorage: nada, basura o JSON que no es lista', () => {
    expect(leerVistas(null)).toEqual([])
    expect(leerVistas('{no es json')).toEqual([])
    expect(leerVistas('{"a":1}')).toEqual([])
    expect(leerVistas('["v0.9.2", 3, null]')).toEqual(['v0.9.2'])
  })

  it('la clave es por USUARIO: dos personas en el mismo navegador no se pisan', () => {
    expect(claveVistas('u1')).not.toBe(claveVistas('u2'))
  })
})

describe('el archivo de verdad, apps/web/novedades.json', () => {
  const datos = JSON.parse(readFileSync(join(__dirname, '..', 'novedades.json'), 'utf8'))

  it('es valido', () => {
    expect(errores(datos)).toEqual([])
  })

  it('trae la entrada de v0.9.2, la version que estrena las notas', () => {
    expect(notasDe('v0.9.2', datos)).not.toBeNull()
  })
})
