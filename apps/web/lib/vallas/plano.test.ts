import { describe, it, expect } from 'vitest'
import { armarPlano, rangoPorOmision, ANCHO_MINIMO_REL, type OcupacionSitio } from './plano'
import type { Valla, GrupoVallas } from './tipos'

// ============================================================================
//  PLANO DE LAS VALLAS (pedido del dueño, 20/11). La función pura que arma el
//  dibujo por sitio: sitios → filas (una por cara) → bloques (un grupo o una
//  valla suelta) → cuadros con su ancho y alto relativos y su estado.
// ============================================================================

let n = 0
function valla(p: Partial<Valla> & { numero: string; sitioId: string }): Valla {
  n += 1
  return {
    id: p.id ?? `v${n}`,
    cara: null,
    ancho: 6,
    alto: 3,
    grupoId: null,
    posicion: null,
    notas: null,
    activo: true,
    ...p,
  }
}

function grupo(p: Partial<GrupoVallas> & { id: string; numero: string }): GrupoVallas {
  return { nombre: null, modo: 'una_imagen', ancho: null, alto: null, notas: null, activo: true, ...p }
}

const SITIOS = [
  { id: 'S1', nombre: 'Periférico Sur 4500' },
  { id: 'S2', nombre: 'Avenida Central' },
]

const ocup = (sitioId: string, marca: string | null, campanaId: string, campanaNombre = `Campaña ${campanaId}`): OcupacionSitio => ({
  sitioId,
  marca,
  campanaId,
  campanaNombre,
  inicio: '2026-11-20',
  fin: '2026-12-20',
})

describe('armarPlano · el boceto del dueño', () => {
  // Sitio: Periférico Sur 4500
  // │ V-001 6x3 │ V-002 6x3 │ V-003 12x3 │   con V-001 y V-002 en G-001
  const vallas = [
    valla({ id: 'a', numero: 'V-001', sitioId: 'S1', grupoId: 'g1', posicion: 1 }),
    valla({ id: 'b', numero: 'V-002', sitioId: 'S1', grupoId: 'g1', posicion: 2 }),
    valla({ id: 'c', numero: 'V-003', sitioId: 'S1', ancho: 12 }),
  ]
  const grupos = [grupo({ id: 'g1', numero: 'G-001', modo: 'una_imagen' })]

  it('un sitio, una fila, dos bloques: el grupo y la valla suelta', () => {
    const p = armarPlano({ vallas, grupos, sitios: SITIOS, ocupaciones: [] })
    expect(p).toHaveLength(1)
    expect(p[0]).toMatchObject({ sitioId: 'S1', nombre: 'Periférico Sur 4500' })
    expect(p[0].filas).toHaveLength(1)
    const bloques = p[0].filas[0].bloques
    expect(bloques.map((b) => b.grupo?.numero ?? null)).toEqual(['G-001', null])
    expect(bloques[0].cuadros.map((c) => c.numero)).toEqual(['V-001', 'V-002'])
    expect(bloques[1].cuadros.map((c) => c.numero)).toEqual(['V-003'])
    expect(bloques[0].grupo).toMatchObject({ numero: 'G-001', modo: 'una_imagen', cruzaSitio: false })
  })

  it('el ancho es proporcional a los metros: 6 + 6 + 12 → ¼, ¼, ½ de la fila más ancha', () => {
    const p = armarPlano({ vallas, grupos, sitios: SITIOS, ocupaciones: [] })
    const fila = p[0].filas[0]
    const cuadros = fila.bloques.flatMap((b) => b.cuadros)
    expect(cuadros.map((c) => c.anchoRel)).toEqual([0.25, 0.25, 0.5])
    expect(fila.anchoRel).toBe(1)
    expect(fila.bloques.map((b) => b.ancho)).toEqual([12, 12])
  })

  it('sin reservas, todo libre', () => {
    const p = armarPlano({ vallas, grupos, sitios: SITIOS, ocupaciones: [] })
    for (const c of p[0].filas[0].bloques.flatMap((b) => b.cuadros)) {
      expect(c.estado).toBe('libre')
      expect(c.ocupantes).toEqual([])
    }
  })

  it('una reserva en el sitio ocupa TODAS sus vallas (las reservas son por sitio)', () => {
    const p = armarPlano({ vallas, grupos, sitios: SITIOS, ocupaciones: [ocup('S1', 'Pepsi', 'k1')] })
    const cuadros = p[0].filas[0].bloques.flatMap((b) => b.cuadros)
    expect(cuadros.every((c) => c.estado === 'ocupada')).toBe(true)
    expect(cuadros[0].ocupantes).toEqual([{ campanaId: 'k1', etiqueta: 'Pepsi' }])
  })

  it('la reserva de OTRO sitio no lo ocupa', () => {
    const p = armarPlano({ vallas, grupos, sitios: SITIOS, ocupaciones: [ocup('S2', 'Pepsi', 'k1')] })
    expect(p[0].filas[0].bloques.flatMap((b) => b.cuadros).every((c) => c.estado === 'libre')).toBe(true)
  })

  it('sin marca, cuenta el nombre de la campaña; la misma campaña dos veces es un solo ocupante', () => {
    const p = armarPlano({
      vallas,
      grupos,
      sitios: SITIOS,
      ocupaciones: [ocup('S1', null, 'k1', 'Navidad'), ocup('S1', null, 'k1', 'Navidad'), ocup('S1', 'Telcel', 'k2')],
    })
    expect(p[0].filas[0].bloques[0].cuadros[0].ocupantes).toEqual([
      { campanaId: 'k1', etiqueta: 'Navidad' },
      { campanaId: 'k2', etiqueta: 'Telcel' },
    ])
  })
})

describe('armarPlano · orden, caras y escala', () => {
  it('una fila por cara (las sin cara al final), y dentro por número', () => {
    const p = armarPlano({
      vallas: [
        valla({ numero: 'V-010', sitioId: 'S1' }),
        valla({ numero: 'V-004', sitioId: 'S1', cara: 2 }),
        valla({ numero: 'V-003', sitioId: 'S1', cara: 1 }),
        valla({ numero: 'V-001', sitioId: 'S1', cara: 1 }),
      ],
      grupos: [],
      sitios: SITIOS,
      ocupaciones: [],
    })
    expect(p[0].filas.map((f) => f.cara)).toEqual([1, 2, null])
    expect(p[0].filas[0].bloques.flatMap((b) => b.cuadros.map((c) => c.numero))).toEqual(['V-001', 'V-003'])
  })

  it('el número se ordena como número: V-2 antes que V-10', () => {
    const p = armarPlano({
      vallas: [valla({ numero: 'V-10', sitioId: 'S1' }), valla({ numero: 'V-2', sitioId: 'S1' })],
      grupos: [],
      sitios: SITIOS,
      ocupaciones: [],
    })
    expect(p[0].filas[0].bloques.map((b) => b.cuadros[0].numero)).toEqual(['V-2', 'V-10'])
  })

  it('dentro del grupo manda la posición (nulos al final); el grupo va donde cae su primer número', () => {
    const p = armarPlano({
      vallas: [
        valla({ numero: 'V-001', sitioId: 'S1' }),
        valla({ numero: 'V-005', sitioId: 'S1', grupoId: 'g', posicion: 1 }),
        valla({ numero: 'V-002', sitioId: 'S1', grupoId: 'g', posicion: 2 }),
        valla({ numero: 'V-009', sitioId: 'S1', grupoId: 'g', posicion: null }),
        valla({ numero: 'V-004', sitioId: 'S1' }),
      ],
      grupos: [grupo({ id: 'g', numero: 'G-1' })],
      sitios: SITIOS,
      ocupaciones: [],
    })
    const b = p[0].filas[0].bloques
    expect(b.map((x) => x.cuadros.map((c) => c.numero))).toEqual([['V-001'], ['V-005', 'V-002', 'V-009'], ['V-004']])
  })

  it('las filas de un sitio comparten escala: la más ancha mide 1', () => {
    const p = armarPlano({
      vallas: [
        valla({ numero: 'V-1', sitioId: 'S1', cara: 1, ancho: 10 }),
        valla({ numero: 'V-2', sitioId: 'S1', cara: 1, ancho: 10 }),
        valla({ numero: 'V-3', sitioId: 'S1', cara: 2, ancho: 5 }),
      ],
      grupos: [],
      sitios: SITIOS,
      ocupaciones: [],
    })
    expect(p[0].filas.map((f) => f.anchoRel)).toEqual([1, 0.25])
  })

  it('el alto es relativo al más alto del sitio, con un mínimo legible', () => {
    const p = armarPlano({
      vallas: [
        valla({ numero: 'V-1', sitioId: 'S1', alto: 8 }),
        valla({ numero: 'V-2', sitioId: 'S1', alto: 4 }),
        valla({ numero: 'V-3', sitioId: 'S1', alto: 0.5 }),
      ],
      grupos: [],
      sitios: SITIOS,
      ocupaciones: [],
    })
    const altos = p[0].filas[0].bloques.map((b) => b.cuadros[0].altoRel)
    expect(altos[0]).toBe(1)
    expect(altos[1]).toBe(0.5)
    expect(altos[2]).toBeGreaterThan(0.0625)
  })

  it('un cuadro muy angosto no baja del mínimo legible', () => {
    const p = armarPlano({
      vallas: [valla({ numero: 'V-1', sitioId: 'S1', ancho: 100 }), valla({ numero: 'V-2', sitioId: 'S1', ancho: 1 })],
      grupos: [],
      sitios: SITIOS,
      ocupaciones: [],
    })
    expect(p[0].filas[0].bloques[1].cuadros[0].anchoRel).toBe(ANCHO_MINIMO_REL)
  })

  it('las vallas de baja no se dibujan, y un sitio sin vallas activas no sale', () => {
    const p = armarPlano({
      vallas: [valla({ numero: 'V-1', sitioId: 'S1', activo: false }), valla({ numero: 'V-2', sitioId: 'S2' })],
      grupos: [],
      sitios: SITIOS,
      ocupaciones: [],
    })
    expect(p.map((s) => s.sitioId)).toEqual(['S2'])
  })

  // Decisión del dueño (20/11): una valla dada de baja NO sale en el plano,
  // tampoco en un sitio que conserva otras activas. Fija el comportamiento
  // que ya había: si alguien quita el filtro de `activo`, esto cae.
  it('en un sitio con una de baja y otra activa, solo se dibuja la activa', () => {
    const p = armarPlano({
      vallas: [valla({ numero: 'V-1', sitioId: 'S1', activo: false }), valla({ numero: 'V-2', sitioId: 'S1' })],
      grupos: [],
      sitios: SITIOS,
      ocupaciones: [],
    })
    const numeros = p.flatMap((s) => s.filas.flatMap((f) => f.bloques.flatMap((b) => b.cuadros.map((c) => c.numero))))
    expect(numeros).toEqual(['V-2'])
  })

  it('los sitios salen por nombre; uno que no está en la lista sale igual, sin nombre', () => {
    const p = armarPlano({
      vallas: [valla({ numero: 'V-1', sitioId: 'S1' }), valla({ numero: 'V-2', sitioId: 'S2' }), valla({ numero: 'V-3', sitioId: 'S9' })],
      grupos: [],
      sitios: SITIOS,
      ocupaciones: [],
    })
    expect(p.map((s) => s.nombre)).toEqual(['Avenida Central', 'Periférico Sur 4500', null])
  })
})

describe('armarPlano · grupos que cruzan', () => {
  it('un grupo con vallas en dos sitios se marca en cada uno, avisando que cruza', () => {
    const p = armarPlano({
      vallas: [
        valla({ numero: 'V-1', sitioId: 'S1', grupoId: 'g', posicion: 1 }),
        valla({ numero: 'V-2', sitioId: 'S2', grupoId: 'g', posicion: 2 }),
      ],
      grupos: [grupo({ id: 'g', numero: 'G-7', modo: 'separadas', nombre: 'Esquina' })],
      sitios: SITIOS,
      ocupaciones: [],
    })
    expect(p).toHaveLength(2)
    for (const s of p) {
      expect(s.filas[0].bloques[0].grupo).toMatchObject({ numero: 'G-7', modo: 'separadas', nombre: 'Esquina', cruzaSitio: true })
    }
  })

  it('un grupo partido en dos caras del mismo sitio sale en las dos filas, sin decir que cruza de sitio', () => {
    const p = armarPlano({
      vallas: [
        valla({ numero: 'V-1', sitioId: 'S1', cara: 1, grupoId: 'g', posicion: 1 }),
        valla({ numero: 'V-2', sitioId: 'S1', cara: 2, grupoId: 'g', posicion: 2 }),
      ],
      grupos: [grupo({ id: 'g', numero: 'G-7' })],
      sitios: SITIOS,
      ocupaciones: [],
    })
    expect(p[0].filas.map((f) => f.bloques[0].grupo?.numero)).toEqual(['G-7', 'G-7'])
    expect(p[0].filas[0].bloques[0].grupo?.cruzaSitio).toBe(false)
  })

  it('una valla que apunta a un grupo que no llegó se dibuja suelta', () => {
    const p = armarPlano({
      vallas: [valla({ numero: 'V-1', sitioId: 'S1', grupoId: 'fantasma' })],
      grupos: [],
      sitios: SITIOS,
      ocupaciones: [],
    })
    expect(p[0].filas[0].bloques[0].grupo).toBeNull()
  })
})

describe('rangoPorOmision', () => {
  it('de hoy (local) a 30 días después', () => {
    expect(rangoPorOmision(new Date(2026, 10, 20, 23, 30))).toEqual({ desde: '2026-11-20', hasta: '2026-12-20' })
  })

  it('cruza de año sin correrse un día', () => {
    expect(rangoPorOmision(new Date(2026, 11, 15, 0, 5))).toEqual({ desde: '2026-12-15', hasta: '2027-01-14' })
  })
})
