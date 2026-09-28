import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
//  QUÉ FRANJA SE CONTRATÓ — el camino de escritura.
// ----------------------------------------------------------------------------
//  Al revés que el VENDEDOR del mismo día, la franja SÍ entra por el cuerpo de
//  la petición: la elige el vendedor en un selector, y no hay de dónde deducirla.
//  Eso abre un agujero R2 que el vendedor no tenía —contratar la franja de otra
//  organización— y se cierra en DOS planos, porque hace falta en los dos:
//
//   1. El esquema: `propuesta_items_franja_fkey` es una FK COMPUESTA
//      `(franja_id, tenant_id)`. Una FK plana se comprueba con los privilegios
//      del DUEÑO de la tabla y ELUDE la RLS; compuesta, la base rechaza la
//      escritura. Es el agujero exacto que midió el 18/09 con `entidad_id`.
//   2. Aquí: para que el usuario lea «esa franja no existe» y no un 500 de
//      restricción. Una FK que salta es un error de programa; el mensaje que
//      lee una persona es trabajo del controller.
//
//  Y lo que NO se hace: el precio NO se recalcula desde la rejilla al crear.
//  Lo que se guarda es lo que se cotizó.
// ============================================================================

const { crearPropuestaMock } = vi.hoisted(() => ({
  crearPropuestaMock: vi.fn(async (input: unknown) => ({ id: 'P1', input })),
}))
const { listarFranjasMock } = vi.hoisted(() => ({
  listarFranjasMock: vi.fn(async () => [
    { id: 'F-PRIME', nombre: 'Prime', horaInicio: '06:00', horaFin: '10:00', orden: 1, activo: true },
  ]),
}))

vi.mock('./propuestas-repo', () => ({
  crearPropuesta: (input: unknown) => crearPropuestaMock(input),
  aprobarItem: vi.fn(),
  PropuestaError: class PropuestaError extends Error {},
  validarRangoFechas: vi.fn(),
}))
vi.mock('./rejilla-repo', () => ({
  listarFranjas: () => listarFranjasMock(),
  listarTemporadas: vi.fn(async () => []),
}))

import { crearPropuestaCtrl } from './propuestas-controller'

const CUERPO = {
  nombre: 'Campaña de prueba',
  fechaInicio: '2026-11-13',
  fechaFin: '2026-11-16',
  items: [{ sitioId: 'S1', unidad: 'spot', tarifaUnitaria: 1800, cantidad: 1 }],
}

beforeEach(() => {
  crearPropuestaMock.mockClear()
  listarFranjasMock.mockClear()
  listarFranjasMock.mockResolvedValue([
    { id: 'F-PRIME', nombre: 'Prime', horaInicio: '06:00', horaFin: '10:00', orden: 1, activo: true },
  ])
})

const enviado = () => crearPropuestaMock.mock.calls[0][0] as any

describe('1 · vender CON franja', () => {
  it('la franja contratada llega al repo', async () => {
    await crearPropuestaCtrl({
      ...CUERPO,
      items: [{ ...CUERPO.items[0], franjaId: 'F-PRIME' }],
    })
    expect(enviado().items[0].franjaId).toBe('F-PRIME')
  })

  it('NO recalcula el precio desde la rejilla: se guarda lo que se cotizó', async () => {
    await crearPropuestaCtrl({
      ...CUERPO,
      items: [{ ...CUERPO.items[0], franjaId: 'F-PRIME' }],
    })
    expect(enviado().items[0].precio).toBe(1800)
    expect(enviado().items[0].tarifaUnitaria).toBe(1800)
  })
})

describe('2 · vender SIN franja sigue funcionando — invariante 1', () => {
  it('sin `franjaId` el ítem llega con `franjaId: null`, no con undefined', async () => {
    // `undefined` en un parámetro de `pg` se envía como NULL igual, pero el
    // contrato explícito es lo que impide que un `?? 'la primera'` futuro se
    // cuele sin que nadie lo note.
    await crearPropuestaCtrl(CUERPO)
    expect(enviado().items[0].franjaId).toBeNull()
  })

  it('NO se consulta el catálogo de franjas cuando ningún ítem la usa', async () => {
    // Toda la base instalada vende así. Un viaje a la base por propuesta —y por
    // cada propuesta que nunca usará franjas— es coste puro.
    await crearPropuestaCtrl(CUERPO)
    expect(listarFranjasMock).not.toHaveBeenCalled()
  })

  it('el modo compatible (precio directo, sin unidad) tampoco se rompe', async () => {
    await crearPropuestaCtrl({
      ...CUERPO,
      items: [{ sitioId: 'S1', precio: 500 }],
    })
    expect(enviado().items[0].precio).toBe(500)
    expect(enviado().items[0].franjaId).toBeNull()
  })
})

describe('3 · los casos negativos — R2 y el catálogo', () => {
  it('una franja que NO es de esta organización se RECHAZA con un mensaje, no con un 500', async () => {
    // `listarFranjas` lee bajo RLS: una franja ajena no aparece en la lista, y
    // por tanto no está entre las válidas. Sin esta comprobación la petición
    // llegaría a la FK compuesta y reventaría con un error de restricción que
    // no le dice nada a quien lo lee.
    await expect(
      crearPropuestaCtrl({ ...CUERPO, items: [{ ...CUERPO.items[0], franjaId: 'F-DE-OTRA-ORG' }] }),
    ).rejects.toThrow(/franja/i)
    expect(crearPropuestaMock).not.toHaveBeenCalled()
  })

  it('una franja DESACTIVADA no se puede contratar', async () => {
    // `listarFranjas()` sin argumentos devuelve solo las activas. Poder vender
    // una franja apagada haría que apagarla no significara nada.
    listarFranjasMock.mockResolvedValue([])
    await expect(
      crearPropuestaCtrl({ ...CUERPO, items: [{ ...CUERPO.items[0], franjaId: 'F-PRIME' }] }),
    ).rejects.toThrow(/franja/i)
    expect(crearPropuestaMock).not.toHaveBeenCalled()
  })

  it('el mensaje NOMBRA el identificador rechazado, para poder diagnosticarlo', async () => {
    await expect(
      crearPropuestaCtrl({ ...CUERPO, items: [{ ...CUERPO.items[0], franjaId: 'F-DE-OTRA-ORG' }] }),
    ).rejects.toThrow(/F-DE-OTRA-ORG/)
  })
})

describe('4 · el fuente del repo, para lo que no se puede simular', () => {
  const fuente = readFileSync(join(__dirname, 'propuestas-repo.ts'), 'utf8')
  const sinComentarios = fuente
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join('\n')

  it('el `insert into propuesta_items` escribe la columna `franja_id`', () => {
    const ins = sinComentarios.slice(
      sinComentarios.indexOf('insert into propuesta_items'),
      sinComentarios.indexOf('insert into propuesta_items') + 900,
    )
    expect(ins).toMatch(/franja_id/)
  })

  it('la reserva HEREDA la franja del ítem y no la recibe de fuera', () => {
    // Si la reserva tomara la franja de un cuerpo de petición, se podría
    // convertir una propuesta en una campaña con OTRA franja que la vendida, y
    // el snapshot y la reserva contarían historias distintas del mismo trato.
    // Vive en `campanas-repo.ts`, que es quien convierte la propuesta.
    const campanas = readFileSync(join(__dirname, 'campanas-repo.ts'), 'utf8')
      .replace(/\r\n/g, '\n') // el árbol está en CRLF; sin esto el ancla no casa
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*)/.test(l))
      .join('\n')
    // HAY DOS `insert into reservas` en este archivo. Se ancla con el contexto
    // ÚNICO del que convierte una propuesta —`spots_reservados, unidad,
    // cantidad, tarifa_unitaria`—, no con la cadena repetida: mirar la otra
    // aparición daría un verde que no significa nada.
    const ancla = 'spots_reservados, unidad, cantidad, tarifa_unitaria'
    expect(campanas.split(ancla).length - 1).toBe(1)
    const ins = campanas.slice(campanas.indexOf(ancla))
    expect(ins.slice(0, 600)).toMatch(/franja_id/)
    // El valor sale de la FILA del ítem (`it.franja_id`), no de un argumento.
    expect(ins.slice(0, 1600)).toMatch(/it\.franja_id/)
  })
})
