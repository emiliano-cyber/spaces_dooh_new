import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { avisoDeLicencia, estadoDeLicencia } from './licencia'

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

// avisoDeLicencia es la unica capa que decide QUE SE PINTA. No comprueba nada
// nuevo: reusa estadoDeLicencia y solo traduce dos de sus cinco salidas a un
// mensaje. Las otras tres devuelven null porque, en cada una, decir algo seria
// describir un estado imposible o innecesario (ver BandaLicencia.tsx).
describe('avisoDeLicencia', () => {
  const base = {
    instancia: 'pixeled',
    dominio: 'pixeled.ejemplo.invalid',
    emitida: '2026-01-01',
    vence: '2027-01-01',
    aviso_dias: 30,
    gracia_dias: 15,
  }

  // El silencio es la senal: si la licencia esta sana, no hay nada que avisar.
  it('sana no dice nada', () => {
    expect(avisoDeLicencia(base, new Date('2026-11-01T00:00:00Z'))).toBeNull()
  })

  // Un hijo ADMINISTRADO no tiene licencia montada: no es un error, es el caso
  // normal de media flota. `estadoDeLicencia` lo lee como `invalida`, y aqui
  // tampoco se pinta nada.
  it('sin licencia (hijo administrado) no dice nada', () => {
    expect(avisoDeLicencia(null, new Date('2026-11-01T00:00:00Z'))).toBeNull()
  })

  it('en aviso devuelve el tono y la fecha de vencimiento', () => {
    expect(avisoDeLicencia(base, new Date('2026-12-15T00:00:00Z'))).toEqual({
      tono: 'aviso',
      vence: '2027-01-01',
      finGracia: '2027-01-16',
    })
  })

  // En gracia la fecha que importa es `finGracia`, no `vence`: no cuando
  // vencio, sino cuando deja de funcionar. Es lo unico que la persona puede
  // hacer algo por evitar.
  it('en gracia devuelve el tono y cuando deja de funcionar', () => {
    expect(avisoDeLicencia(base, new Date('2027-01-05T00:00:00Z'))).toEqual({
      tono: 'gracia',
      vence: '2027-01-01',
      finGracia: '2027-01-16',
    })
  })

  // vencida e invalida no dicen nada: en esos estados `update.sh` ya apago el
  // contenedor (vencida) o no hay nada valido que leer (invalida). En ambos
  // casos pintar algo describiria un estado que no puede darse con este codigo
  // corriendo.
  it('vencida no dice nada', () => {
    expect(avisoDeLicencia(base, new Date('2027-02-01T00:00:00Z'))).toBeNull()
  })

  it('invalida no dice nada', () => {
    expect(avisoDeLicencia({ ...base, vence: 'el mes que viene' }, new Date('2026-11-01T00:00:00Z'))).toBeNull()
  })
})
