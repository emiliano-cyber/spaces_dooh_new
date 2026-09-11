import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { estadoDeLicencia } from './licencia'

// El banco vive fuera de `apps/web` a proposito: lo comparte con el arnes de
// `update.sh`, que es la otra implementacion de esta misma regla.
const BANCO = join(fileURLToPath(new URL('.', import.meta.url)), '../../../infra/licencias/estados.casos.tsv')

function casos() {
  return readFileSync(BANCO, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const [vence, aviso_dias, gracia_dias, hoy, estado] = l.split('\t')
      return { vence, aviso_dias: Number(aviso_dias), gracia_dias: Number(gracia_dias), hoy, estado }
    })
}

describe('estadoDeLicencia · el banco de casos compartido', () => {
  // Si el banco se queda vacio por un error de ruta, todos los `it` de abajo
  // desaparecen y la suite pasa en verde sin haber comprobado nada. Esta linea
  // es lo unico que separa "cero fallos" de "cero pruebas".
  it('el banco se lee y tiene casos', () => {
    expect(casos().length).toBeGreaterThanOrEqual(10)
  })

  for (const c of casos()) {
    it(`vence ${c.vence} · aviso ${c.aviso_dias} · gracia ${c.gracia_dias} · hoy ${c.hoy} -> ${c.estado}`, () => {
      const licencia = {
        instancia: 'pixeled',
        dominio: 'pixeled.ejemplo.invalid',
        emitida: '2026-01-01',
        vence: c.vence,
        aviso_dias: c.aviso_dias,
        gracia_dias: c.gracia_dias,
      }
      expect(estadoDeLicencia(licencia, new Date(`${c.hoy}T00:00:00Z`))).toBe(c.estado)
    })
  }
})

// Y los negativos, que son el corazon: una licencia rota NUNCA se lee como sana.
// Es la direccion en la que un fallo hace dano -- dar por buena la que no lo es.
describe('estadoDeLicencia · lo que no es una licencia', () => {
  const base = {
    instancia: 'pixeled',
    dominio: 'pixeled.ejemplo.invalid',
    emitida: '2026-01-01',
    vence: '2027-01-01',
    aviso_dias: 30,
    gracia_dias: 15,
  }
  const ahora = new Date('2026-11-01T00:00:00Z')

  it('sin objeto es invalida', () => {
    expect(estadoDeLicencia(null, ahora)).toBe('invalida')
    expect(estadoDeLicencia(undefined, ahora)).toBe('invalida')
    expect(estadoDeLicencia('2027-01-01', ahora)).toBe('invalida')
  })

  it('sin `vence` es invalida, no sana', () => {
    const { vence, ...sinVence } = base
    expect(estadoDeLicencia(sinVence, ahora)).toBe('invalida')
  })

  it('una fecha que no es una fecha es invalida', () => {
    expect(estadoDeLicencia({ ...base, vence: 'el mes que viene' }, ahora)).toBe('invalida')
  })

  it('los dias que no son numeros no caen a un valor por omision', () => {
    expect(estadoDeLicencia({ ...base, aviso_dias: 'treinta' }, ahora)).toBe('invalida')
    expect(estadoDeLicencia({ ...base, gracia_dias: -1 }, ahora)).toBe('invalida')
  })
})
