import { describe, it, expect } from 'vitest'
import { armarPlano, rangoPorOmision, ordenTrasMover, ANCHO_MINIMO_REL, type OcupacionSitio } from './plano'
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

// ============================================================================
//  «Dibujar plano» en la propuesta (dueño, 20/11 noche): el MISMO plano, solo
//  con los sitios de esa propuesta. `sitioIds` filtra; sin él salen todos
//  (la pantalla de Vallas no cambia).
// ============================================================================
describe('armarPlano · filtrado por los sitios de una propuesta', () => {
  const vallas = [
    valla({ id: 'p1', numero: 'V-001', sitioId: 'S1', grupoId: 'gx', posicion: 1 }),
    valla({ id: 'p2', numero: 'V-002', sitioId: 'S2', grupoId: 'gx', posicion: 2 }),
    valla({ id: 'p3', numero: 'V-003', sitioId: 'S2' }),
  ]
  const grupos = [grupo({ id: 'gx', numero: 'G-009' })]

  it('sin sitioIds salen todos los sitios con vallas (como en /vallas)', () => {
    expect(armarPlano({ vallas, grupos, sitios: SITIOS, ocupaciones: [] }).map((s) => s.sitioId)).toEqual(['S2', 'S1'])
  })

  it('con sitioIds solo esos sitios; las ocupaciones de otros no entran', () => {
    const p = armarPlano({ vallas, grupos, sitios: SITIOS, ocupaciones: [ocup('S1', 'Pepsi', 'k1')], sitioIds: ['S2'] })
    expect(p.map((s) => s.sitioId)).toEqual(['S2'])
    expect(p[0].filas.flatMap((f) => f.bloques.flatMap((b) => b.cuadros)).every((c) => c.estado === 'libre')).toBe(true)
  })

  it('un grupo que sigue en un sitio que NO es de la propuesta se sigue marcando como que cruza', () => {
    const [s1] = armarPlano({ vallas, grupos, sitios: SITIOS, ocupaciones: [], sitioIds: ['S1'] })
    expect(s1.filas[0].bloques[0].grupo).toMatchObject({ numero: 'G-009', cruzaSitio: true })
  })

  it('sitios sin vallas, o la lista vacía → plano vacío', () => {
    expect(armarPlano({ vallas, grupos, sitios: SITIOS, ocupaciones: [], sitioIds: ['S9'] })).toEqual([])
    expect(armarPlano({ vallas, grupos, sitios: SITIOS, ocupaciones: [], sitioIds: [] })).toEqual([])
  })

  it('una valla dada de baja no sale aunque su sitio sea de la propuesta', () => {
    const conBaja = [...vallas, valla({ id: 'p4', numero: 'V-004', sitioId: 'S1', activo: false })]
    const [s1] = armarPlano({ vallas: conBaja, grupos, sitios: SITIOS, ocupaciones: [], sitioIds: ['S1'] })
    expect(s1.filas.flatMap((f) => f.bloques.flatMap((b) => b.cuadros.map((c) => c.numero)))).toEqual(['V-001'])
  })
})

// ============================================================================
//  ESQUINAS (dueño, 20/11): «hay vallas que están en esquinas y doblan a la
//  derecha o izquierda, para que se muestre». Una valla con `dobla` parte su
//  cara en TRAMOS: lo que viene después va en un tramo nuevo, marcado con la
//  dirección del quiebre. La fila entera (`bloques`) no cambia.
// ============================================================================
describe('armarPlano · esquinas', () => {
  const numeros = (t: { bloques: { cuadros: { numero: string }[] }[] }) => t.bloques.flatMap((b) => b.cuadros.map((c) => c.numero))

  it('sin `dobla`: un solo tramo recto con toda la fila y sin esquina al final', () => {
    const p = armarPlano({
      vallas: [valla({ numero: 'E-001', sitioId: 'S1' }), valla({ numero: 'E-002', sitioId: 'S1' })],
      grupos: [],
      sitios: SITIOS,
      ocupaciones: [],
    })
    const f = p[0].filas[0]
    expect(f.tramos).toHaveLength(1)
    expect(f.tramos[0].gira).toBeNull()
    expect(numeros(f.tramos[0])).toEqual(['E-001', 'E-002'])
    expect(f.esquinaFinal).toBeNull()
    expect(f.bloques.flatMap((b) => b.cuadros).map((c) => c.dobla)).toEqual([null, null])
  })

  it('una valla que dobla a la derecha parte la fila: el tramo siguiente gira a la derecha', () => {
    const p = armarPlano({
      vallas: [
        valla({ numero: 'E-001', sitioId: 'S1' }),
        valla({ numero: 'E-002', sitioId: 'S1', dobla: 'derecha' }),
        valla({ numero: 'E-003', sitioId: 'S1', ancho: 12 }),
      ],
      grupos: [],
      sitios: SITIOS,
      ocupaciones: [],
    })
    const f = p[0].filas[0]
    expect(f.tramos.map((t) => t.gira)).toEqual([null, 'derecha'])
    expect(f.tramos.map(numeros)).toEqual([['E-001', 'E-002'], ['E-003']])
    // La valla que dobla sigue siendo un cuadro normal, con su dato.
    expect(f.tramos[0].bloques[1].cuadros[0]).toMatchObject({ numero: 'E-002', dobla: 'derecha', ancho: 6 })
    expect(f.tramos.map((t) => t.ancho)).toEqual([12, 12])
    expect(f.esquinaFinal).toBeNull()
    // La fila entera, la de siempre.
    expect(f.bloques.flatMap((b) => b.cuadros).map((c) => c.numero)).toEqual(['E-001', 'E-002', 'E-003'])
  })

  it('dos quiebres: izquierda y luego derecha → tres tramos', () => {
    const p = armarPlano({
      vallas: [
        valla({ numero: 'E-001', sitioId: 'S1', dobla: 'izquierda' }),
        valla({ numero: 'E-002', sitioId: 'S1', dobla: 'derecha' }),
        valla({ numero: 'E-003', sitioId: 'S1' }),
      ],
      grupos: [],
      sitios: SITIOS,
      ocupaciones: [],
    })
    expect(p[0].filas[0].tramos.map((t) => [t.gira, numeros(t)])).toEqual([
      [null, ['E-001']],
      ['izquierda', ['E-002']],
      ['derecha', ['E-003']],
    ])
  })

  it('la ÚLTIMA valla que dobla no abre tramo vacío: la esquina queda al final', () => {
    const p = armarPlano({
      vallas: [valla({ numero: 'E-001', sitioId: 'S1' }), valla({ numero: 'E-002', sitioId: 'S1', dobla: 'izquierda' })],
      grupos: [],
      sitios: SITIOS,
      ocupaciones: [],
    })
    const f = p[0].filas[0]
    expect(f.tramos).toHaveLength(1)
    expect(f.esquinaFinal).toBe('izquierda')
  })

  it('un grupo que cruza la esquina sale en los dos tramos, marcado completo y con los cortes dichos', () => {
    const p = armarPlano({
      vallas: [
        valla({ numero: 'E-001', sitioId: 'S1', grupoId: 'g1', posicion: 1 }),
        valla({ numero: 'E-002', sitioId: 'S1', grupoId: 'g1', posicion: 2, dobla: 'derecha' }),
        valla({ numero: 'E-003', sitioId: 'S1', grupoId: 'g1', posicion: 3 }),
        valla({ numero: 'E-004', sitioId: 'S1' }),
      ],
      grupos: [grupo({ id: 'g1', numero: 'G-001' })],
      sitios: SITIOS,
      ocupaciones: [],
    })
    const [t1, t2] = p[0].filas[0].tramos
    expect(t1.bloques).toHaveLength(1)
    expect(t1.bloques[0]).toMatchObject({ grupo: { numero: 'G-001' }, cortadoAntes: false, cortadoDespues: true, ancho: 12 })
    expect(t2.gira).toBe('derecha')
    expect(t2.bloques[0]).toMatchObject({ grupo: { numero: 'G-001' }, cortadoAntes: true, cortadoDespues: false, ancho: 6 })
    expect(numeros(t2)).toEqual(['E-003', 'E-004'])
    // Fuera de la esquina, el bloque no está cortado.
    expect(t2.bloques[1]).toMatchObject({ grupo: null, cortadoAntes: false, cortadoDespues: false })
  })

  it('el quiebre es por cara: una cara que dobla no parte a la otra', () => {
    const p = armarPlano({
      vallas: [
        valla({ numero: 'E-001', sitioId: 'S1', cara: 1, dobla: 'derecha' }),
        valla({ numero: 'E-002', sitioId: 'S1', cara: 1 }),
        valla({ numero: 'E-003', sitioId: 'S1', cara: 2 }),
        valla({ numero: 'E-004', sitioId: 'S1', cara: 2 }),
      ],
      grupos: [],
      sitios: SITIOS,
      ocupaciones: [],
    })
    expect(p[0].filas.map((f) => f.tramos.length)).toEqual([2, 1])
  })
})

// ============================================================================
//  LIGA DEL CLIENTE (dueño, 20/11): el cliente solo recibe las vallas de SU
//  propuesta, así que armarPlano no puede deducir que un grupo sigue en otro
//  sitio. El servidor lo dice con `gruposQueSiguenFuera` (sin decir cuál).
// ============================================================================
describe('armarPlano · grupos que siguen fuera de lo que se dibuja', () => {
  it('un grupo marcado como que sigue fuera sale con cruzaSitio, aunque todas sus vallas estén aquí', () => {
    const [s1] = armarPlano({
      vallas: [valla({ numero: 'V-1', sitioId: 'S1', grupoId: 'g', posicion: 1 })],
      grupos: [grupo({ id: 'g', numero: 'G-1' })],
      sitios: SITIOS,
      ocupaciones: [],
      gruposQueSiguenFuera: ['g'],
    })
    expect(s1.filas[0].bloques[0].grupo?.cruzaSitio).toBe(true)
  })

  it('sin la marca, un grupo de un solo sitio no cruza (como siempre)', () => {
    const [s1] = armarPlano({
      vallas: [valla({ numero: 'V-1', sitioId: 'S1', grupoId: 'g', posicion: 1 })],
      grupos: [grupo({ id: 'g', numero: 'G-1' })],
      sitios: SITIOS,
      ocupaciones: [],
      gruposQueSiguenFuera: [],
    })
    expect(s1.filas[0].bloques[0].grupo?.cruzaSitio).toBe(false)
  })
})

// ============================================================================
//  MOVER DESDE EL PLANO (dueño, 24/11: «tocar y flechas»). Una fila que alguien
//  ya reacomodó tiene `posicion` en TODAS sus vallas y el plano la respeta;
//  una que nadie tocó se ordena como siempre (por número, el grupo donde cae
//  su número más bajo). `ordenTrasMover` da la fila entera, ya movida, para
//  guardarla de una vez.
// ============================================================================
describe('armarPlano · fila reacomodada a mano', () => {
  it('con posición en TODAS las vallas manda la posición, también entre sueltas y grupos', () => {
    const p = armarPlano({
      vallas: [
        valla({ id: 'a', numero: 'V-001', sitioId: 'S1', posicion: 4 }),
        valla({ id: 'b', numero: 'V-002', sitioId: 'S1', grupoId: 'g', posicion: 2 }),
        valla({ id: 'c', numero: 'V-003', sitioId: 'S1', grupoId: 'g', posicion: 3 }),
        valla({ id: 'd', numero: 'V-004', sitioId: 'S1', posicion: 1 }),
      ],
      grupos: [grupo({ id: 'g', numero: 'G-1' })],
      sitios: SITIOS,
      ocupaciones: [],
    })
    expect(p[0].filas[0].bloques.map((x) => x.cuadros.map((c) => c.numero))).toEqual([['V-004'], ['V-002', 'V-003'], ['V-001']])
  })

  it('si a una sola le falta la posición, la fila se ordena como siempre (filas que nadie tocó)', () => {
    const p = armarPlano({
      vallas: [
        valla({ numero: 'V-001', sitioId: 'S1', posicion: null }),
        valla({ numero: 'V-002', sitioId: 'S1', grupoId: 'g', posicion: 1 }),
        valla({ numero: 'V-003', sitioId: 'S1', grupoId: 'g', posicion: 2 }),
      ],
      grupos: [grupo({ id: 'g', numero: 'G-1' })],
      sitios: SITIOS,
      ocupaciones: [],
    })
    expect(p[0].filas[0].bloques.map((x) => x.cuadros.map((c) => c.numero))).toEqual([['V-001'], ['V-002', 'V-003']])
  })
})

describe('ordenTrasMover', () => {
  const fila = () =>
    armarPlano({
      vallas: [
        valla({ id: 'a', numero: 'V-001', sitioId: 'S1' }),
        valla({ id: 'b', numero: 'V-002', sitioId: 'S1', grupoId: 'g', posicion: 1 }),
        valla({ id: 'c', numero: 'V-003', sitioId: 'S1', grupoId: 'g', posicion: 2 }),
        valla({ id: 'd', numero: 'V-004', sitioId: 'S1' }),
      ],
      grupos: [grupo({ id: 'g', numero: 'G-1' })],
      sitios: SITIOS,
      ocupaciones: [],
    })[0].filas[0]

  it('una valla suelta a la derecha salta el grupo entero (el grupo no se parte)', () => {
    expect(ordenTrasMover(fila(), 'a', 'derecha')).toEqual(['b', 'c', 'a', 'd'])
  })

  it('una valla suelta a la izquierda, igual', () => {
    expect(ordenTrasMover(fila(), 'd', 'izquierda')).toEqual(['a', 'd', 'b', 'c'])
  })

  it('dentro del grupo se cambia con su vecina del grupo', () => {
    expect(ordenTrasMover(fila(), 'b', 'derecha')).toEqual(['a', 'c', 'b', 'd'])
    expect(ordenTrasMover(fila(), 'c', 'izquierda')).toEqual(['a', 'c', 'b', 'd'])
  })

  it('en la orilla no se mueve: null', () => {
    expect(ordenTrasMover(fila(), 'a', 'izquierda')).toBeNull()
    expect(ordenTrasMover(fila(), 'd', 'derecha')).toBeNull()
    // La orilla del GRUPO también: un miembro no sale de su grupo con flechas.
    expect(ordenTrasMover(fila(), 'b', 'izquierda')).toBeNull()
    expect(ordenTrasMover(fila(), 'c', 'derecha')).toBeNull()
  })

  it('una valla que no está en la fila: null', () => {
    expect(ordenTrasMover(fila(), 'zz', 'derecha')).toBeNull()
  })
})
