import { describe, it, expect } from 'vitest'
import {
  avisosDeProgramacion,
  textoAccionProgramacion,
  etiquetaFranja,
} from './franja-programada'

// ============================================================================
//  PROG-01 · la regla «se vendió como X y se programa en Y», en UNA función.
// ----------------------------------------------------------------------------
//  Decisión del dueño (2026-09-30): la franja de la pantalla Franjas y
//  temporadas es para el HORARIO DE TRANSMISIÓN, porque «el precio ya debe de
//  estar en la campaña después de la propuesta». Programar es otra cosa que
//  vender: lo contratado vive en `reservas.franja_id` y no se toca; lo
//  programado vive aparte.
//
//  Que las dos DIFIERAN no se prohíbe —hoy se AVISA— y esa es una decisión
//  pendiente del dueño. Por eso la regla vive en un solo sitio: el día que
//  decida bloquear, se cambia aquí y no en tres pantallas.
// ============================================================================

const PRIME = { id: 'F-PRIME', nombre: 'Prime', horaInicio: '06:00', horaFin: '10:00' }
const NOCHE = { id: 'F-NOCHE', nombre: 'Noche', horaInicio: '20:00', horaFin: '23:00' }

describe('1 · cuándo NO hay nada que avisar', () => {
  it('sin franja programada no se avisa, aunque se haya vendido una', () => {
    // Sin programar no hay contraste posible: avisar aquí pintaría un recuadro
    // en TODA campaña vendida con franja, y un aviso que sale siempre deja de
    // leerse.
    expect(
      avisosDeProgramacion({
        programada: null,
        contratadas: [{ franjaId: PRIME.id, franjaNombre: 'Prime', pantallas: 2 }],
      }),
    ).toEqual([])
  })

  it('programada IGUAL a la contratada: nada', () => {
    expect(
      avisosDeProgramacion({
        programada: PRIME,
        contratadas: [{ franjaId: PRIME.id, franjaNombre: 'Prime', pantallas: 3 }],
      }),
    ).toEqual([])
  })

  it('lo vendido SIN franja («todo el día») no es una discrepancia', () => {
    // Se vendió sin compromiso horario: programarlo en una franja no contradice
    // nada de lo que el cliente aceptó.
    expect(
      avisosDeProgramacion({
        programada: NOCHE,
        contratadas: [{ franjaId: null, franjaNombre: null, pantallas: 4 }],
      }),
    ).toEqual([])
  })

  it('una campaña sin reservas no avisa', () => {
    expect(avisosDeProgramacion({ programada: PRIME, contratadas: [] })).toEqual([])
  })
})

describe('2 · cuándo SÍ — el corazón', () => {
  it('se vendió Prime y se programa en Noche: un aviso que nombra las dos', () => {
    const a = avisosDeProgramacion({
      programada: NOCHE,
      contratadas: [{ franjaId: PRIME.id, franjaNombre: 'Prime', pantallas: 1 }],
    })
    expect(a).toHaveLength(1)
    expect(a[0].franjaContratadaId).toBe(PRIME.id)
    expect(a[0].texto).toMatch(/vendió como «Prime»/)
    expect(a[0].texto).toMatch(/se programa en «Noche»/)
    expect(a[0].texto).toMatch(/1 pantalla\b/)
  })

  it('cuenta las pantallas en plural', () => {
    const a = avisosDeProgramacion({
      programada: NOCHE,
      contratadas: [{ franjaId: PRIME.id, franjaNombre: 'Prime', pantallas: 3 }],
    })
    expect(a[0].texto).toMatch(/3 pantallas/)
  })

  it('SOLO avisa de las líneas que difieren, no de todas', () => {
    const a = avisosDeProgramacion({
      programada: PRIME,
      contratadas: [
        { franjaId: PRIME.id, franjaNombre: 'Prime', pantallas: 2 },
        { franjaId: NOCHE.id, franjaNombre: 'Noche', pantallas: 1 },
        { franjaId: null, franjaNombre: null, pantallas: 5 },
      ],
    })
    expect(a.map((x) => x.franjaContratadaId)).toEqual([NOCHE.id])
  })

  it('suma las pantallas de la misma franja aunque lleguen en dos filas', () => {
    const a = avisosDeProgramacion({
      programada: NOCHE,
      contratadas: [
        { franjaId: PRIME.id, franjaNombre: 'Prime', pantallas: 1 },
        { franjaId: PRIME.id, franjaNombre: 'Prime', pantallas: 2 },
      ],
    })
    expect(a).toHaveLength(1)
    expect(a[0].pantallas).toBe(3)
  })

  it('una franja contratada que ya no tiene nombre (dada de baja o ajena) se nombra igual', () => {
    // Nunca un «se vendió como null». Si el nombre no llega, se dice que no se
    // conoce en vez de inventarlo.
    const a = avisosDeProgramacion({
      programada: NOCHE,
      contratadas: [{ franjaId: 'F-VIEJA', franjaNombre: null, pantallas: 1 }],
    })
    expect(a[0].texto).not.toMatch(/null|undefined/)
    expect(a[0].texto).toMatch(/otra franja/)
  })

  it('el aviso NO dice que se bloquee: hoy solo se avisa (decisión pendiente)', () => {
    const a = avisosDeProgramacion({
      programada: NOCHE,
      contratadas: [{ franjaId: PRIME.id, franjaNombre: 'Prime', pantallas: 1 }],
    })
    expect(a[0].texto).not.toMatch(/no se puede|bloque/i)
  })
})

describe('3 · el texto de la bitácora', () => {
  it('asignar nombra la franja y cuenta las campañas', () => {
    const t = textoAccionProgramacion({
      franja: PRIME,
      campanas: [
        { folio: 'CMP-1', nombre: 'Uno' },
        { folio: 'CMP-2', nombre: 'Dos' },
      ],
    })
    expect(t.accion).toMatch(/Programó .*Prime.* en 2 campañas/)
    expect(t.entidad).toContain('CMP-1')
    expect(t.entidad).toContain('CMP-2')
  })

  it('en singular con una sola campaña', () => {
    const t = textoAccionProgramacion({ franja: PRIME, campanas: [{ folio: 'CMP-1', nombre: 'Uno' }] })
    expect(t.accion).toMatch(/en 1 campaña$/)
  })

  it('quitar dice que se quitó, no que se programó', () => {
    const t = textoAccionProgramacion({ franja: null, campanas: [{ folio: null, nombre: 'Sin folio' }] })
    expect(t.accion).toMatch(/Quitó la franja programada de 1 campaña/)
    // Sin folio se usa el nombre: una bitácora con «null» no dice nada.
    expect(t.entidad).toBe('Sin folio')
  })
})

describe('4 · la etiqueta de una franja', () => {
  it('nombre y horario', () => {
    expect(etiquetaFranja(PRIME)).toBe('Prime · 06:00–10:00')
  })
  it('sin horario, solo el nombre', () => {
    expect(etiquetaFranja({ id: 'x', nombre: 'Prime' })).toBe('Prime')
  })
})
