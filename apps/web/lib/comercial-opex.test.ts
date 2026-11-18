import { describe, it, expect } from 'vitest'
import {
  DIAS_ENFRIADO,
  diasSinContacto,
  enfriados,
  resumen,
  espacioElegido,
  iniciales,
  type EspacioResumen,
} from './comercial-opex'

// ============================================================================
//  Comercial negociación · las cuentas de la pantalla.
// ----------------------------------------------------------------------------
//  Nacieron en la maqueta (30/09) sobre datos de ejemplo y se quedan ahora que
//  hay base (NEG-01, 22/10): el último contacto ya no sale de una lista escrita
//  a mano sino de `ultimoContactoEn`, el avance más reciente que devuelve la
//  API. Lo que se prueba es lo mismo: cuántos días lleva un espacio sin
//  contacto y cuáles hay que retomar. Una cuenta sin prueba se equivoca en
//  silencio.
// ============================================================================

const HOY = new Date('2026-09-30T12:00:00Z')

const base = (o: Partial<EspacioResumen> = {}): EspacioResumen => ({
  id: 'x',
  etapa: 'NEGOCIACION',
  ultimoContactoEn: null,
  ...o,
})

describe('1 · los días sin contacto', () => {
  it('salen del avance más reciente', () => {
    expect(diasSinContacto(base({ ultimoContactoEn: '2026-09-20T12:00:00Z' }), HOY)).toBe(10)
  })

  it('sin bitácora devuelve NULL, y null NO es cero', () => {
    // «Nunca se ha hablado» y «se habló hoy» son cosas distintas. Pintar un 0
    // donde no se sabe es el `?? 0` del mapa otra vez.
    expect(diasSinContacto(base(), HOY)).toBeNull()
    expect(diasSinContacto(base(), HOY)).not.toBe(0)
  })
})

describe('2 · cuáles hay que retomar', () => {
  it('uno EN NEGOCIACIÓN pasado el umbral entra', () => {
    expect(enfriados([base({ ultimoContactoEn: '2026-07-01T12:00:00Z' })], HOY)).toHaveLength(1)
  })

  it('justo EN el umbral todavía NO entra: es «más de 30», no «30 o más»', () => {
    const hace30 = new Date(HOY)
    hace30.setUTCDate(hace30.getUTCDate() - DIAS_ENFRIADO)
    const e = base({ ultimoContactoEn: hace30.toISOString() })
    expect(diasSinContacto(e, HOY)).toBe(DIAS_ENFRIADO)
    expect(enfriados([e], HOY)).toHaveLength(0)
  })

  it('un ACTIVO (aprobado) no entra aunque lleve un año: está contratado, no perseguido', () => {
    expect(enfriados([base({ etapa: 'APROBADO', ultimoContactoEn: '2025-01-01T12:00:00Z' })], HOY)).toHaveLength(0)
  })

  it('un INACTIVO (perdido) tampoco: nadie lo está trabajando', () => {
    expect(enfriados([base({ etapa: 'PERDIDO', ultimoContactoEn: '2025-01-01T12:00:00Z' })], HOY)).toHaveLength(0)
  })

  it('uno SIN bitácora no entra: no se puede afirmar que se enfrió', () => {
    expect(enfriados([base()], HOY)).toHaveLength(0)
  })
})

describe('3 · el resumen de arriba', () => {
  it('cuenta en seguimiento, en negociación, activos y enfriados', () => {
    const r = resumen(
      [
        base({ id: 'a', ultimoContactoEn: '2026-07-01T12:00:00Z' }),
        base({ id: 'b', etapa: 'CONTACTADO', ultimoContactoEn: '2026-09-29T12:00:00Z' }),
        base({ id: 'c', etapa: 'APROBADO' }),
        base({ id: 'd', etapa: 'PERDIDO' }),
      ],
      HOY,
    )
    expect(r).toEqual({ total: 4, enNegociacion: 2, activos: 1, enfriados: 1 })
  })
})

describe('espacioElegido · qué espacio se detalla', () => {
  const lista = [base({ id: 'a' }), base({ id: 'b' })]
  it('devuelve el elegido por su id', () => {
    expect(espacioElegido(lista, 'b')).toBe(lista[1])
  })
  it('sin elección, o con un id que no existe, el PRIMERO — nunca una pantalla vacía', () => {
    expect(espacioElegido(lista, null)).toBe(lista[0])
    expect(espacioElegido(lista, 'no-existe')).toBe(lista[0])
  })
  it('sin espacios, null', () => {
    expect(espacioElegido([], 'x')).toBeNull()
  })
})

describe('iniciales · el círculo de cada contacto (2026-09-30)', () => {
  it('quita el tratamiento y toma dos iniciales', () => {
    expect(iniciales('Ing. Roberto Salinas')).toBe('RS')
    expect(iniciales('Lic. Andrea Ruiz')).toBe('AR')
  })
  it('ignora paréntesis, números y signos: «C(» se colaba en la primera versión', () => {
    expect(iniciales('Sra. Carmen (vecina 1418)')).toBe('CV')
  })
  it('un nombre vacío no revienta', () => {
    expect(iniciales('')).toBe('')
  })
})
