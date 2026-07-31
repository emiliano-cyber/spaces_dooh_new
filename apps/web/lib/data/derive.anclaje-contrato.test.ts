import { describe, it, expect } from 'vitest'
import { rentaAtribuidaPorSitio, margenPorSitio, contratoVigentePorSitio } from './derive'

// ============================================================================
//  Los DOS anclajes del contrato de arrendamiento, según la regla del negocio:
//
//    · Un predio tiene UN contrato y lo comparten todas sus pantallas.
//    · Una pantalla suelta (sin predio) tiene su propio contrato.
//
//  Lo que se protege aquí es que la renta no desaparezca ni se cuente dos
//  veces. Antes de este arreglo, la pantalla suelta salía con renta 0 y
//  `tieneContrato: false` aunque tuviera contrato vigente: el sistema la
//  reportaba como espacio GRATIS y su margen era el ingreso íntegro.
//
//  El detalle que lo hacía silencioso: un contrato de predio también trae
//  `sitioId` (la columna es NOT NULL), así que el discriminador tiene que ser
//  `predioId`. Resolver por `sitioId` parece funcionar y cobra doble.
// ============================================================================

const BASE: any = {
  campanas: [{ id: 'K', nombre: 'Campaña', moneda: 'MXN' }],
  facturas: [], cobranzas: [], ordenesTrabajo: [], creatividades: [],
  ordenesImpresion: [], evidencias: [], incidencias: [], pagosRenta: [],
  arrendadores: [{ id: 'A1', nombre: 'Arrendador Uno' }], clientes: [],
  propuestas: [], ordenesCompra: [], notificaciones: [], acciones: [],
  sitiosRed: [], razonesSociales: [], reservas: [],
}

// Reserva vigente hoy, para poder mirar el margen.
function reservaHoy(id: string, sitioId: string, precio: number) {
  const ayer = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  const manana = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
  return { id, sitioId, campanaId: 'K', estatus: 'CONFIRMADA', precio, fechaInicio: ayer, fechaFin: manana }
}

const contratoBase = { arrendadorId: 'A1', fechaInicio: '2026-01-01', fechaFin: '2026-12-31', moneda: 'MXN', estatus: 'VIGENTE' }

describe('pantalla SUELTA (sin predio) con contrato propio', () => {
  const estado: any = {
    ...BASE, predios: [],
    sitios: [{ id: 'S1', nombre: 'Suelta', predioId: null, caras: 1 }],
    contratos: [{ id: 'C1', sitioId: 'S1', predioId: null, montoRenta: 10000, periodicidad: 'MENSUAL', ...contratoBase }],
    reservas: [reservaHoy('R1', 'S1', 25000)],
  }

  it('carga la renta ÍNTEGRA a esa pantalla', () => {
    expect(rentaAtribuidaPorSitio(estado).get('S1')).toBe(10000)
  })

  it('el margen descuenta la renta en vez de regalar el espacio', () => {
    const m = margenPorSitio(estado).find((x) => x.sitioId === 'S1')!
    expect(m.rentaMensual).toBe(10000)
    expect(m.margenMensual).toBe(15000) // 25,000 − 10,000, no 25,000
  })

  it('reconoce que SÍ tiene contrato y a quién se le paga', () => {
    const m = margenPorSitio(estado).find((x) => x.sitioId === 'S1')!
    expect(m.tieneContrato).toBe(true)
    expect(m.arrendador).toBe('Arrendador Uno')
  })

  it('NO divide la renta entre las caras de la misma pantalla', () => {
    // Las caras son lados de una pantalla, no pantallas distintas: el contrato
    // cubre la pantalla completa.
    const dosCaras = { ...estado, sitios: [{ id: 'S1', nombre: 'Suelta', predioId: null, caras: 2 }] }
    expect(rentaAtribuidaPorSitio(dosCaras).get('S1')).toBe(10000)
  })
})

describe('predio con varias pantallas: UN contrato compartido', () => {
  // El contrato del predio arrastra `sitioId: 'S1'` (columna NOT NULL). Si la
  // resolución mirara ese campo, S1 pagaría los 30,000 completos y S2/S3 nada.
  const estado: any = {
    ...BASE,
    predios: [{ id: 'P1', nombre: 'Predio' }],
    sitios: [
      { id: 'S1', nombre: 'Cara 1', predioId: 'P1', caras: 1 },
      { id: 'S2', nombre: 'Cara 2', predioId: 'P1', caras: 1 },
      { id: 'S3', nombre: 'Cara 3', predioId: 'P1', caras: 1 },
    ],
    contratos: [{ id: 'C1', sitioId: 'S1', predioId: 'P1', montoRenta: 30000, periodicidad: 'MENSUAL', ...contratoBase }],
    reservas: [reservaHoy('R1', 'S1', 25000)],
  }

  it('reparte la renta en partes iguales entre las 3 pantallas', () => {
    const r = rentaAtribuidaPorSitio(estado)
    expect(r.get('S1')).toBe(10000)
    expect(r.get('S2')).toBe(10000)
    expect(r.get('S3')).toBe(10000)
  })

  it('la pantalla que el contrato nombra NO paga de más', () => {
    // Regresión directa: `sitioId` apunta a S1 y no debe darle la renta entera.
    expect(rentaAtribuidaPorSitio(estado).get('S1')).not.toBe(30000)
  })

  it('las tres comparten el MISMO contrato', () => {
    const c = contratoVigentePorSitio(estado)
    expect(c.get('S1')!.id).toBe('C1')
    expect(c.get('S2')!.id).toBe('C1')
    expect(c.get('S3')!.id).toBe('C1')
  })

  it('todas reportan contrato, no solo la nombrada', () => {
    expect(margenPorSitio(estado).every((m) => m.tieneContrato)).toBe(true)
  })

  it('la suma repartida es exactamente la renta del contrato', () => {
    const r = rentaAtribuidaPorSitio(estado)
    const suma = ['S1', 'S2', 'S3'].reduce((s, id) => s + r.get(id)!, 0)
    expect(suma).toBe(30000) // ni se pierde ni se infla
  })
})

describe('no cuenta doble cuando hay contratos de más', () => {
  it('una pantalla con predio ignora el contrato suelto que arrastre', () => {
    // El flujo de propuesta puede crear un contrato por pantalla sin ver el del
    // predio. Mientras eso no se corrija, el P&L no debe sumar los dos.
    const estado: any = {
      ...BASE,
      predios: [{ id: 'P1', nombre: 'Predio' }],
      sitios: [{ id: 'S1', nombre: 'Cara', predioId: 'P1', caras: 1 }],
      contratos: [
        { id: 'C1', sitioId: 'S1', predioId: 'P1', montoRenta: 10000, periodicidad: 'MENSUAL', ...contratoBase },
        { id: 'C2', sitioId: 'S1', predioId: null, montoRenta: 7000, periodicidad: 'MENSUAL', ...contratoBase },
      ],
      reservas: [],
    }
    expect(rentaAtribuidaPorSitio(estado).get('S1')).toBe(10000) // manda el del predio, no 17,000
    expect(contratoVigentePorSitio(estado).get('S1')!.id).toBe('C1')
  })
})

describe('pantalla EN un predio que todavía no tiene contrato', () => {
  // Caso real: el flujo de propuesta crea contratos VIGENTES con importe y sin
  // predio (la renta capturada en la propuesta). Si esa pantalla pertenece a un
  // predio que aún no tiene contrato firmado, esa renta es la única que hay y
  // no puede desaparecer del P&L.
  const estado: any = {
    ...BASE,
    predios: [{ id: 'P1', nombre: 'Predio sin contrato' }],
    sitios: [
      { id: 'S1', nombre: 'Vendida', predioId: 'P1', caras: 1 },
      { id: 'S2', nombre: 'Hermana', predioId: 'P1', caras: 1 },
    ],
    contratos: [{ id: 'C1', sitioId: 'S1', predioId: null, montoRenta: 8000, periodicidad: 'MENSUAL', ...contratoBase }],
    reservas: [reservaHoy('R1', 'S1', 20000)],
  }

  it('usa el contrato propio de la pantalla en vez de reportar renta 0', () => {
    expect(rentaAtribuidaPorSitio(estado).get('S1')).toBe(8000)
  })

  it('NO reparte esa renta entre las hermanas del predio', () => {
    // El contrato cubre una sola pantalla: repartirlo le cobraría a S2, que ese
    // contrato no cubre, y dejaría a S1 pagando de menos.
    const r = rentaAtribuidaPorSitio(estado)
    expect(r.get('S1')).toBe(8000)
    expect(r.get('S2')).toBe(0)
  })

  it('en cuanto el predio tiene contrato, ese manda y el propio se ignora', () => {
    const conPredio = {
      ...estado,
      contratos: [
        ...estado.contratos,
        { id: 'C2', sitioId: 'S1', predioId: 'P1', montoRenta: 30000, periodicidad: 'MENSUAL', ...contratoBase },
      ],
    }
    const r = rentaAtribuidaPorSitio(conPredio)
    expect(r.get('S1')).toBe(15000) // 30,000 entre las 2 caras del predio
    expect(r.get('S2')).toBe(15000)
    expect(r.get('S1')! + r.get('S2')!).toBe(30000) // no 38,000: el propio NO se suma
  })
})

describe('sin contrato activo', () => {
  it('una pantalla suelta cuyo contrato venció no arrastra costo', () => {
    const estado: any = {
      ...BASE, predios: [],
      sitios: [{ id: 'S1', nombre: 'Suelta', predioId: null, caras: 1 }],
      contratos: [{ id: 'C1', sitioId: 'S1', predioId: null, montoRenta: 10000, periodicidad: 'MENSUAL', ...contratoBase, estatus: 'VENCIDO' }],
      reservas: [],
    }
    expect(rentaAtribuidaPorSitio(estado).get('S1')).toBe(0)
    expect(margenPorSitio(estado)[0].tieneContrato).toBe(false)
  })

  it('un contrato INCOMPLETO no inventa renta', () => {
    // Nace al aprobar la propuesta sin importe: no es un costo hasta que alguien
    // capture los términos pactados.
    const estado: any = {
      ...BASE, predios: [],
      sitios: [{ id: 'S1', nombre: 'Suelta', predioId: null, caras: 1 }],
      contratos: [{ id: 'C1', sitioId: 'S1', predioId: null, ...contratoBase, arrendadorId: null, montoRenta: null, periodicidad: null, estatus: 'INCOMPLETO' }],
      reservas: [],
    }
    expect(rentaAtribuidaPorSitio(estado).get('S1')).toBe(0)
  })
})

describe('periodicidad en pantalla suelta', () => {
  it('normaliza a mensual igual que en el predio', () => {
    const estado: any = {
      ...BASE, predios: [],
      sitios: [{ id: 'S1', nombre: 'Suelta', predioId: null, caras: 1 }],
      contratos: [{ id: 'C1', sitioId: 'S1', predioId: null, montoRenta: 30000, periodicidad: 'TRIMESTRAL', ...contratoBase }],
      reservas: [],
    }
    expect(rentaAtribuidaPorSitio(estado).get('S1')).toBe(10000)
  })
})
