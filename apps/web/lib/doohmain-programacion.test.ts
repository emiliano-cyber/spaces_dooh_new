import { describe, it, expect } from 'vitest'
import {
  programacionDoohmain,
  clienteDoohmain,
  diasDeCampana,
  textoHorario,
  textoReproducciones,
  franjaQueViaja,
  motivoHorarioInvalido,
  pantallaDoohmainEfectiva,
  textoOrigenDoohmain,
} from './doohmain-programacion'

describe('el horario individual de la campaña (22/10, noche)', () => {
  const programada = { horaInicio: '18:00', horaFin: '22:00' }
  const individual = { horaInicio: '07:30', horaFin: '09:00', dias: [1, 2, 3, 4, 5] }

  it('el individual gana sobre la programada y la contratada', () => {
    expect(franjaQueViaja({ individual, programadaOContratada: programada })).toEqual(individual)
  })

  it('sin individual, la programada o contratada (todos los días)', () => {
    expect(franjaQueViaja({ individual: null, programadaOContratada: programada })).toEqual({ ...programada, dias: null })
  })

  it('sin ninguna, no viaja horario', () => {
    expect(franjaQueViaja({ individual: null, programadaOContratada: null })).toBeNull()
  })

  it('los días viajan con el horario, y el texto los nombra', () => {
    const p = programacionDoohmain({ cantDia: 4, fechaInicio: '2026-11-02', fechaFin: '2026-11-06', franja: individual })
    expect(p.dias).toEqual([1, 2, 3, 4, 5])
    expect(textoHorario(p)).toBe('07:30 a 09:00 · lun, mar, mié, jue, vie')
  })

  it('sin días, el texto no los nombra (son todos)', () => {
    const p = programacionDoohmain({ cantDia: 4, fechaInicio: '2026-11-02', fechaFin: '2026-11-06', franja: programada })
    expect(p.dias).toBeNull()
    expect(textoHorario(p)).toBe('18:00 a 22:00')
  })

  it('qué horario individual se acepta', () => {
    expect(motivoHorarioInvalido({ horaInicio: '07:30', horaFin: '09:00', dias: null })).toBeNull()
    expect(motivoHorarioInvalido({ horaInicio: '07:30', horaFin: '09:00', dias: [0, 6] })).toBeNull()
    expect(motivoHorarioInvalido({ horaInicio: '7:30', horaFin: '09:00', dias: null })).toMatch(/HH:mm/)
    expect(motivoHorarioInvalido({ horaInicio: '09:00', horaFin: '09:00', dias: null })).toMatch(/iguales/)
    expect(motivoHorarioInvalido({ horaInicio: '07:30', horaFin: '09:00', dias: [7] })).toMatch(/día/)
    expect(motivoHorarioInvalido({ horaInicio: '07:30', horaFin: '09:00', dias: [1, 1] })).toMatch(/repet/)
    expect(motivoHorarioInvalido({ horaInicio: '07:30', horaFin: '09:00', dias: [] })).toMatch(/al menos/)
  })
})

describe('el id de DOOHmain de cada pantalla, el que SE USA (Inventario)', () => {
  it('el de la ficha manda', () => {
    expect(pantallaDoohmainEfectiva({ ficha: 'SCR-12', clave: 'A-1', mapa: { 'A-1': 'MAPA-1' }, porOmision: 'DEF' })).toEqual({
      pantalla: 'SCR-12',
      origen: 'ficha',
    })
  })

  it('sin ficha, el del mapa del servidor: «ya estaba» y no se veía', () => {
    expect(pantallaDoohmainEfectiva({ ficha: null, clave: 'A-1', mapa: { 'A-1': 'MAPA-1' }, porOmision: 'DEF' })).toEqual({
      pantalla: 'MAPA-1',
      origen: 'mapa',
    })
  })

  it('sin ficha ni mapa, la pantalla por omisión del servidor', () => {
    expect(pantallaDoohmainEfectiva({ ficha: '  ', clave: 'A-1', mapa: {}, porOmision: 'DEF' })).toEqual({
      pantalla: 'DEF',
      origen: 'servidor',
    })
  })

  it('el texto del origen dice si está escrita o la pone el servidor', () => {
    expect(textoOrigenDoohmain('ficha')).toMatch(/ficha/)
    expect(textoOrigenDoohmain('mapa')).toMatch(/mapa del servidor/)
    expect(textoOrigenDoohmain('servidor')).toMatch(/por omisión/)
    expect(textoOrigenDoohmain(null)).toMatch(/no recibiría nada/)
  })

  it('sin nada, null: esa pantalla no recibiría nada', () => {
    expect(pantallaDoohmainEfectiva({ ficha: null, clave: 'A-1', mapa: {}, porOmision: null })).toEqual({
      pantalla: null,
      origen: null,
    })
  })
})

// ============================================================================
//  Lo que se le manda a DOOHmain de cada pantalla: cuántas reproducciones, en
//  qué horario, y quién es el cliente.
// ----------------------------------------------------------------------------
//  Pedido del dueño el 2026-10-22: «mandar cuántas reproducciones en la franja
//  de tiempo si es que tiene o cuántas en total del tiempo de la campaña, además
//  de mandar los datos de cliente, y todo lo que recibe DOOHmain. La franja de
//  tiempo solo la debe mandar si es que tiene una; si no, mandamos lo que
//  actualmente se manda.»
//
//  La API (docs/doohmain-api-2.8.4.md) recibe en la campaña `cant_total`,
//  `cant_day`, `cant_hour`, `auto_cant` y el cliente (`name`, `cuit`,
//  `real_name`, `address`, `client_type`), y en el spot `start_time` /
//  `end_time`. Hasta hoy solo viajaban las fechas, el nombre del cliente y
//  `cant_day`.
// ============================================================================

describe('los días de la campaña', () => {
  it('cuentan los dos extremos', () => {
    expect(diasDeCampana('2026-11-01', '2026-11-30')).toBe(30)
    expect(diasDeCampana('2026-11-01', '2026-11-01')).toBe(1)
  })

  it('un periodo al revés no da días negativos', () => {
    expect(diasDeCampana('2026-11-30', '2026-11-01')).toBe(0)
  })
})

describe('sin franja: lo de siempre, más el total del periodo', () => {
  it('con spots por día contratados: la cuota diaria y el TOTAL de la campaña', () => {
    const p = programacionDoohmain({ cantDia: 6, fechaInicio: '2026-11-01', fechaFin: '2026-11-30', franja: null })
    expect(p).toEqual({ cantDia: 6, cantTotal: 180, horaInicio: null, horaFin: null, dias: null, autoCant: false })
  })

  it('sin pauta contratada no se dicta NADA, igual que hasta hoy', () => {
    // Las reservas sin `spots_por_dia` dejan que el CMS ponga los que quepan.
    // Inventar un total ahí sería dictar una cuota que nadie pactó.
    const p = programacionDoohmain({ cantDia: null, fechaInicio: '2026-11-01', fechaFin: '2026-11-30', franja: null })
    expect(p).toEqual({ cantDia: null, cantTotal: null, horaInicio: null, horaFin: null, dias: null, autoCant: false })
  })
})

describe('con franja: el horario viaja, y las reproducciones caen dentro', () => {
  const franja = { horaInicio: '18:00', horaFin: '22:00' }

  it('manda el horario y pide repartir las reproducciones dentro de él', () => {
    const p = programacionDoohmain({ cantDia: 8, fechaInicio: '2026-11-01', fechaFin: '2026-11-10', franja })
    expect(p).toEqual({ cantDia: 8, cantTotal: 80, horaInicio: '18:00', horaFin: '22:00', dias: null, autoCant: true })
  })

  it('con franja pero sin pauta: el horario sí viaja, las cantidades no', () => {
    const p = programacionDoohmain({ cantDia: null, fechaInicio: '2026-11-01', fechaFin: '2026-11-10', franja })
    expect(p).toEqual({ cantDia: null, cantTotal: null, horaInicio: '18:00', horaFin: '22:00', dias: null, autoCant: false })
  })

  it('una hora que no es HH:mm no viaja: se manda como si no hubiera franja', () => {
    const p = programacionDoohmain({
      cantDia: 4, fechaInicio: '2026-11-01', fechaFin: '2026-11-02', franja: { horaInicio: '7pm', horaFin: '22:00' },
    })
    expect(p.horaInicio).toBeNull()
    expect(p.horaFin).toBeNull()
    expect(p.autoCant).toBe(false)
  })
})

describe('lo que la ficha de la campaña enseña antes de publicar (22/10)', () => {
  const p = (o: Partial<Parameters<typeof textoHorario>[0]> = {}) => ({
    cantDia: null, cantTotal: null, horaInicio: null, horaFin: null, dias: null, autoCant: false, ...o,
  })

  it('el horario: la franja si la hay; si no, que es todo el día', () => {
    expect(textoHorario(p({ horaInicio: '18:00', horaFin: '22:00' }))).toBe('18:00 a 22:00')
    expect(textoHorario(p())).toBe('Todo el día (sin franja)')
  })

  it('las reproducciones: por día y en toda la campaña', () => {
    expect(textoReproducciones(p({ cantDia: 8, cantTotal: 240 }))).toEqual({ porDia: '8', total: '240' })
  })

  it('sin pauta contratada NO se pinta un cero: se dice que las pone DOOHmain', () => {
    // Pintar «0» diría que no sale nunca, y sale las que quepan.
    expect(textoReproducciones(p())).toEqual({ porDia: 'Las que quepan', total: 'Las que quepan' })
  })

  it('los miles llevan separador, para que 12000 no se lea 1200', () => {
    expect(textoReproducciones(p({ cantDia: 400, cantTotal: 12000 })).total).toBe('12,000')
  })
})

describe('el cliente', () => {
  it('manda todo lo que hay: nombre, RFC, razón social, dirección y tipo', () => {
    expect(
      clienteDoohmain({
        nombre: 'Cervecería del Valle',
        rfc: 'CVA010203AB1',
        razonSocial: 'Cervecería del Valle SA de CV',
        contacto: { direccion: 'Av. Reforma 100, CDMX' },
        tipo: 'AGENCIA',
      }),
    ).toEqual({
      nombre: 'Cervecería del Valle',
      rfc: 'CVA010203AB1',
      razonSocial: 'Cervecería del Valle SA de CV',
      direccion: 'Av. Reforma 100, CDMX',
      tipo: 'Agencia',
    })
  })

  it('lo que no hay no se manda: null, no una cadena vacía', () => {
    expect(clienteDoohmain({ nombre: 'Solo nombre', rfc: '  ', razonSocial: null, contacto: {}, tipo: null })).toEqual({
      nombre: 'Solo nombre',
      rfc: null,
      razonSocial: null,
      direccion: null,
      tipo: null,
    })
  })

  it('sin cliente, el nombre de siempre', () => {
    expect(clienteDoohmain(null).nombre).toBe('Sin cliente')
  })
})
