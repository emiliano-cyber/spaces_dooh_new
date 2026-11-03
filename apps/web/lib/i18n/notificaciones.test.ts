import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { traducirNotificacion } from './notificaciones'
import { ES_NOTIFICACIONES } from './textos/notificaciones'
import { fijarMonedaInstancia } from './dinero'
import { recordatoriosDeContratos, type ContratoParaAviso } from '../recordatorios-contratos'

// ============================================================================
//  OLA 6 · LAS NOTIFICACIONES DE LA CAMPANITA, TRADUCIDAS AL PINTARLAS.
// ----------------------------------------------------------------------------
//  El servidor las guarda en espanol, como dato, y eso NO cambia. La pantalla
//  reconoce el texto guardado con las plantillas de `textos/notificaciones.ts`
//  y lo rearma en ingles conservando folios, nombres e importes (el importe con
//  el formato ingles: `MX$`). Lo que no casa se pinta tal cual.
//
//  Tres cosas que se fijan aqui:
//   · en espanol sale EXACTAMENTE lo guardado;
//   · cada plantilla es el literal del archivo del servidor que la escribe
//     (si alguien retoca la frase alli, esta prueba se pone en rojo en vez de
//     dejar la traduccion huerfana sin aviso);
//   · lo desconocido no se toca.
// ============================================================================

const RAIZ = path.join(__dirname, '../..')
const leer = (f: string) => readFileSync(path.join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n')
const en = (titulo: string, detalle: string | null = null) => traducirNotificacion({ titulo, detalle }, 'en')

afterEach(() => fijarMonedaInstancia('MXN'))

// Lo que el servidor guarda, armado igual que alli (folios, nombres y cifras de
// ejemplo). La columna 3 es lo que se pinta en ingles.
const CASOS: Array<[string, string | null, string, string | null]> = [
  ['Propuesta aprobada', 'PR-0007 · Verano 2026', 'Proposal approved', 'PR-0007 · Verano 2026'],
  ['Propuesta rechazada', 'PR-0007 · Verano 2026', 'Proposal rejected', 'PR-0007 · Verano 2026'],
  [
    'Propuesta aceptada por el cliente',
    'PR-0007 · Verano 2026 — aceptada por Lucía Pérez',
    'Proposal accepted by the client',
    'PR-0007 · Verano 2026 — accepted by Lucía Pérez',
  ],
  ['Campaña generada desde propuesta', 'CA-0012 · Verano 2026', 'Campaign generated from proposal', 'CA-0012 · Verano 2026'],
  [
    'No se pudo generar la campaña',
    'Propuesta no encontrada',
    'Could not generate the campaign',
    'Proposal not found',
  ],
  [
    'Campaña por validar',
    'Verano 2026 se envió al dominio y espera validación de publicación',
    'Campaign awaiting publication review',
    'Verano 2026 was submitted for publishing and is awaiting publication review',
  ],
  ['Publicación aprobada', 'Verano 2026 fue validada y está al aire', 'Publication approved', 'Verano 2026 was approved and is on air'],
  ['Publicación rechazada', 'Verano 2026 fue rechazada', 'Publication rejected', 'Verano 2026 was rejected'],
  [
    'Publicación rechazada',
    'Verano 2026 fue rechazada: el arte está pixelado',
    'Publication rejected',
    // El motivo lo teclea una persona: es dato y se conserva.
    'Verano 2026 was rejected: el arte está pixelado',
  ],
  [
    'Publicación rechazada',
    // El nombre es lo PRIMERO que escribe el servidor: el corte va en la primera
    // « fue rechazada», y el motivo se queda entero aunque repita la frase.
    'Verano 2026 fue rechazada: igual que Otoño fue rechazada: sin logo',
    'Publication rejected',
    'Verano 2026 was rejected: igual que Otoño fue rechazada: sin logo',
  ],
  ['Factura emitida', 'F001-0007 · 120,000', 'Invoice issued', 'F001-0007 · 120,000'],
  ['ODC registrada', 'ODC-3 · 45,000.5', 'PO recorded', 'ODC-3 · 45,000.5'],
  ['Cobranza liquidada', 'F001-0007', 'Paid in full', 'F001-0007'],
  ['Abono registrado', 'cobranza', 'Partial payment recorded', 'collection'],
  [
    'Cobranza vencida',
    'F001-0007 · Cliente Uno — vencida hace 4 día(s) · saldo $247,080',
    'Overdue collection',
    'F001-0007 · Cliente Uno — 4 days overdue · balance MX$247,080',
  ],
  [
    'Cobranza vencida',
    'F001-0007 — vencida hace 1 día(s) · saldo $1,000',
    'Overdue collection',
    'F001-0007 — 1 day overdue · balance MX$1,000',
  ],
  [
    'Recordatorio de cobro',
    'F001-0008 · Cliente Dos — vence en 12 día(s) · saldo $3,480',
    'Payment reminder',
    'F001-0008 · Cliente Dos — due in 12 days · balance MX$3,480',
  ],
  [
    'Recordatorio de cobro',
    'F001-0008 — vence en 1 día(s) · saldo $3,480',
    'Payment reminder',
    'F001-0008 — due in 1 day · balance MX$3,480',
  ],
  // Ola 7: el dia del vencimiento el servidor escribe «vence en 0 día(s)».
  // En ingles «due today», no «due in 0 days».
  [
    'Recordatorio de cobro',
    'F001-0008 · Cliente Dos — vence en 0 día(s) · saldo $3,480',
    'Payment reminder',
    'F001-0008 · Cliente Dos — due today · balance MX$3,480',
  ],
  ['OT vencida', 'OT-14 · Pantalla Reforma no se cerró a tiempo', 'Overdue work order', 'OT-14 · Pantalla Reforma was not closed on time'],
  ['OT vencida', 'OT-14 no se cerró a tiempo (sin asignar)', 'Overdue work order', 'OT-14 was not closed on time (unassigned)'],
]

describe('notificaciones · en espanol sale lo guardado, letra por letra', () => {
  for (const [titulo, detalle] of CASOS) {
    it(`${titulo} · ${detalle}`, () => {
      const n = { titulo, detalle, id: 'x', link: null }
      expect(traducirNotificacion(n, 'es')).toEqual(n)
    })
  }
})

describe('notificaciones · en ingles se rearman con sus datos', () => {
  for (const [titulo, detalle, tituloEn, detalleEn] of CASOS) {
    it(`${titulo} · ${detalle}`, () => {
      expect(en(titulo, detalle)).toEqual({ titulo: tituloEn, detalle: detalleEn })
    })
  }

  it('conserva el resto de los campos del aviso', () => {
    const n = { id: 'n1', titulo: 'Factura emitida', detalle: null, nivel: 'ok', link: '/finanzas', leida: true }
    expect(traducirNotificacion(n, 'en')).toEqual({ ...n, titulo: 'Invoice issued' })
  })

  it('el saldo de una instancia en dolares sale con «$» en ingles', () => {
    fijarMonedaInstancia('USD')
    expect(en('Cobranza vencida', 'F1 — vencida hace 2 día(s) · saldo US$5,300').detalle).toBe(
      'F1 — 2 days overdue · balance $5,300',
    )
  })
})

describe('notificaciones · lo desconocido se pinta tal cual', () => {
  it('un titulo que no es de ninguna plantilla', () => {
    expect(en('Pago registrado', 'Detalle')).toEqual({ titulo: 'Pago registrado', detalle: 'Detalle' })
  })
  it('un detalle que no casa con las plantillas de su titulo', () => {
    // «cobranza» solo es el folio que falta en un pago: en otro aviso es dato.
    expect(en('Factura emitida', 'cobranza')).toEqual({ titulo: 'Invoice issued', detalle: 'cobranza' })
    // La frase de una OT no se reconoce bajo el titulo de una propuesta.
    expect(en('Propuesta aprobada', 'OT-1 no se cerró a tiempo').detalle).toBe('OT-1 no se cerró a tiempo')
  })
  it('el saldo que no es un importe deja el detalle en espanol, entero', () => {
    const d = 'F1 — vencida hace 2 día(s) · saldo pendiente'
    expect(en('Cobranza vencida', d).detalle).toBe(d)
  })
  it('un titulo que solo EMPIEZA como una plantilla no casa', () => {
    expect(en('Propuesta aprobada por fin').titulo).toBe('Propuesta aprobada por fin')
    expect(en('Ya: Propuesta aprobada').titulo).toBe('Ya: Propuesta aprobada')
  })
  it('el error que no esta en el catalogo de errores se queda en espanol', () => {
    expect(en('No se pudo generar la campaña', 'algo raro').detalle).toBe('algo raro')
  })
  it('sin detalle no inventa uno', () => {
    expect(en('Propuesta aprobada', null).detalle).toBeNull()
  })
})

// ─── Los recordatorios de contratos salen de una funcion pura: se arman de verdad ─

describe('notificaciones · los recordatorios de contratos, armados por su funcion', () => {
  const hoy = new Date(2026, 10, 3)
  const base: ContratoParaAviso = {
    id: 'k1',
    estatus: 'VIGENTE',
    fechaFin: null,
    predioNombre: 'Predio Norte',
    sitioNombre: null,
    arrendadorNombre: 'Juan Ruiz',
  } as ContratoParaAviso
  const un = (c: Partial<ContratoParaAviso>) => recordatoriosDeContratos([{ ...base, ...c } as ContratoParaAviso], hoy)[0]

  const casos: Array<[string, Partial<ContratoParaAviso>, string, string]> = [
    [
      'sin capturar',
      { estatus: 'INCOMPLETO' },
      'Contract not entered: Predio Norte · Juan Ruiz',
      'It is missing the landlord, the rent amount, the payment frequency or the end date. Until then it does not count as a cost, it does not generate a payment schedule and the screen cannot be booked.',
    ],
    [
      'vencido hace 1 dia',
      { fechaFin: '2026-11-02' },
      'Contract expired: Predio Norte · Juan Ruiz',
      'It expired 1 day ago and nobody has renewed it. The space is still in use with no current agreement to back it.',
    ],
    [
      'vencido hace 9 dias',
      { fechaFin: '2026-10-25' },
      'Contract expired: Predio Norte · Juan Ruiz',
      'It expired 9 days ago and nobody has renewed it. The space is still in use with no current agreement to back it.',
    ],
    [
      'vence hoy',
      { fechaFin: '2026-11-03' },
      'Contract expires TODAY: Predio Norte · Juan Ruiz',
      'If it is going to be renewed, it’s best to act before it expires.',
    ],
    [
      'vence en 1 dia',
      { fechaFin: '2026-11-04' },
      'Contract expires in 1 day: Predio Norte · Juan Ruiz',
      'If it is going to be renewed, it’s best to act before it expires.',
    ],
    [
      'vence en 3 dias',
      { fechaFin: '2026-11-06' },
      'Contract expires in 3 days: Predio Norte · Juan Ruiz',
      'If it is going to be renewed, it’s best to act before it expires.',
    ],
    [
      'sin nombre de predio ni pantalla ni arrendador',
      { estatus: 'INCOMPLETO', predioNombre: null, arrendadorNombre: null },
      'Contract not entered: a space',
      'It is missing the landlord, the rent amount, the payment frequency or the end date. Until then it does not count as a cost, it does not generate a payment schedule and the screen cannot be booked.',
    ],
    [
      'sin nombre, con arrendador',
      { fechaFin: '2026-11-03', predioNombre: null },
      'Contract expires TODAY: a space · Juan Ruiz',
      'If it is going to be renewed, it’s best to act before it expires.',
    ],
  ]

  for (const [nombre, c, titulo, detalle] of casos) {
    it(nombre, () => {
      const r = un(c)
      expect(r, 'la funcion armo un aviso').toBeTruthy()
      expect(traducirNotificacion(r, 'es')).toEqual(r)
      expect(traducirNotificacion({ titulo: r.titulo, detalle: r.detalle }, 'en')).toEqual({ titulo, detalle })
    })
  }

  it('un «vence en 0 días» (que hoy el servidor escribe «HOY») dice «today», no «in 0 days»', () => {
    expect(en('Contrato vence en 0 días: Predio Norte').titulo).toBe('Contract expires TODAY: Predio Norte')
    expect(traducirNotificacion({ titulo: 'Contrato vence en 0 días: Predio Norte', detalle: null }, 'es').titulo).toBe(
      'Contrato vence en 0 días: Predio Norte',
    )
  })

  it('el cero solo cambia la cifra 0: «10» y «20» siguen en plural', () => {
    expect(en('Recordatorio de cobro', 'F1 — vence en 10 día(s) · saldo $1').detalle).toBe('F1 — due in 10 days · balance MX$1')
    expect(en('Contrato vence en 20 días: P').titulo).toBe('Contract expires in 20 days: P')
  })

  it('una plantilla SIN variante .cero usa el plural con 0, no una clave inexistente', () => {
    // Hoy el servidor no avisa de una cobranza vencida hace 0 dias; si llegara,
    // esta plantilla no tiene .cero y debe caer al plural (mutante v07 de la ola 7).
    expect(en('Cobranza vencida', 'F1 — vencida hace 0 día(s) · saldo $1').detalle).toBe('F1 — 0 days overdue · balance MX$1')
  })

  it('«un espacio» solo se traduce cuando es el nombre que pone el servidor', () => {
    // Un predio que se llama «un espacio comercial» es dato.
    expect(en('Contrato vencido: un espacio comercial').titulo).toBe('Contract expired: un espacio comercial')
  })
})

// ─── Cada plantilla es el literal del servidor que la escribe ───────────────

describe('notificaciones · las plantillas son los literales del servidor', () => {
  const ES = ES_NOTIFICACIONES as Record<string, string>

  // [archivo, fragmento exacto del codigo]. Si alguien cambia la frase en el
  // servidor, el fragmento deja de estar y esta prueba lo dice.
  const FUENTES: Array<[string, string]> = [
    ['app/api/propuestas/[id]/route.ts', `titulo: prop.estatus === 'APROBADA' ? '${ES['notificaciones.propuesta.aprobada']}' : '${ES['notificaciones.propuesta.rechazada']}'`],
    ['app/api/propuestas/[id]/route.ts', `titulo: '${ES['notificaciones.campana.generada']}'`],
    ['app/api/propuestas/[id]/route.ts', `titulo: '${ES['notificaciones.campana.no-generada']}'`],
    ['app/api/propuestas/[id]/route.ts', 'detalle: (e as Error).message'],
    ['app/api/propuestas/[id]/generar-campana/route.ts', `titulo: '${ES['notificaciones.campana.generada']}'`],
    ['lib/server/propuestas-repo.ts', `'${ES['notificaciones.propuesta.aceptada']}',`],
    ['lib/server/propuestas-repo.ts', '`${p.folio} · ${p.nombre} — aceptada por ${nombre}`'],
    ['app/api/campanas/[id]/enviar-dominio/route.ts', `titulo: '${ES['notificaciones.campana.por-validar']}'`],
    ['app/api/campanas/[id]/enviar-dominio/route.ts', '`${c.nombre} se envió al dominio y espera validación de publicación`'],
    ['app/api/campanas/[id]/validar/route.ts', `titulo: body?.aprobar ? '${ES['notificaciones.publicacion.aprobada']}' : '${ES['notificaciones.publicacion.rechazada']}'`],
    ['app/api/campanas/[id]/validar/route.ts', '`${c.nombre} fue validada y está al aire`'],
    ['app/api/campanas/[id]/validar/route.ts', "`${c.nombre} fue rechazada${c.validacionMotivo ? `: ${c.validacionMotivo}` : ''}`"],
    ['app/api/campanas/[id]/facturar/route.ts', `titulo: '${ES['notificaciones.factura.emitida']}'`],
    ['app/api/ordenes-compra/route.ts', `titulo: '${ES['notificaciones.odc.registrada']}'`],
    ['app/api/cobranzas/[id]/pagar/route.ts', `titulo: c.liquidado ? '${ES['notificaciones.pago.liquidada']}' : '${ES['notificaciones.pago.abono']}', detalle: c.folio ?? '${ES['notificaciones.pago.sin-folio']}'`],
    ['lib/server/finanzas-repo.ts', `titulo: vencida ? '${ES['notificaciones.cobranza.vencida']}' : '${ES['notificaciones.cobranza.recordatorio']}'`],
    ['lib/server/finanzas-repo.ts', "`${r.folio}${r.cliente ? ` · ${r.cliente}` : ''} — ` +"],
    ['lib/server/finanzas-repo.ts', "(vencida ? `vencida hace ${-r.dias} día(s)` : `vence en ${r.dias} día(s)`) +"],
    ['lib/server/finanzas-repo.ts', '` · saldo ${fmtMonto(r.saldo)}`'],
    ['lib/server/finanzas-repo.ts', "simboloMoneda() + Math.round(v).toLocaleString('es-MX')"],
    ['lib/server/ot-repo.ts', `titulo: '${ES['notificaciones.ot.vencida']}'`],
    ['lib/server/ot-repo.ts', "`${ot.folio}${ot.sitio ? ` · ${ot.sitio}` : ''} no se cerró a tiempo${ot.asignado_a ? '' : ' (sin asignar)'}`"],
    ['lib/recordatorios-contratos.ts', "const cual = c.predioNombre || c.sitioNombre || 'un espacio'"],
  ]

  for (const [archivo, fragmento] of FUENTES) {
    it(`${archivo} · ${fragmento.slice(0, 60)}`, () => {
      expect(leer(archivo)).toContain(fragmento)
    })
  }

  it('el recordatorio de contratos lo inserta la ruta con el titulo y el detalle de la funcion', () => {
    const s = leer('app/api/recordatorios/route.ts')
    expect(s).toContain('recordatoriosDeContratos(')
    expect(s).toMatch(/a\.titulo, a\.detalle/)
  })

  it('no hay otro sitio del servidor que cree notificaciones', () => {
    // Si aparece uno nuevo, hay que darle su plantilla aqui (o declararlo).
    const sitios = [
      'app/api/campanas/[id]/enviar-dominio/route.ts',
      'app/api/campanas/[id]/facturar/route.ts',
      'app/api/campanas/[id]/validar/route.ts',
      'app/api/cobranzas/[id]/pagar/route.ts',
      'app/api/ordenes-compra/route.ts',
      'app/api/propuestas/[id]/generar-campana/route.ts',
      'app/api/propuestas/[id]/route.ts',
      'app/api/recordatorios/route.ts',
      'lib/server/finanzas-repo.ts',
      'lib/server/ot-repo.ts',
      'lib/server/propuestas-repo.ts',
    ]
    const { execSync } = require('node:child_process') as typeof import('node:child_process')
    const salida = execSync('git grep -l -E "notificar\\(\\{|insert into notificaciones \\(" -- app lib', { cwd: RAIZ, encoding: 'utf8' })
    const hallados = salida
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s && !/\.test\.ts$/.test(s) && !s.startsWith('lib/server/notificaciones-repo.ts'))
      .sort()
    expect(hallados).toEqual([...sitios].sort())
  })
})

// ─── Los dos sitios que pintan un aviso: la campanita y el aviso emergente ──

describe('notificaciones · quien las pinta pasa por la traduccion', () => {
  it('la campanita (`ItemNotificacion`): titulo, detalle y el nombre del boton de borrar', () => {
    const s = leer('components/demo/shell/ItemNotificacion.tsx')
    expect(s).toContain('const v = traducirNotificacion(n, idioma)')
    expect(s).toContain('{v.titulo}</span>')
    expect(s).toContain('title={v.detalle}')
    expect(s).toContain("t('shell.notificacion.borrar-aria', { titulo: v.titulo })")
    expect(s).not.toMatch(/\{n\.(titulo|detalle)\}/)
  })
  it('el aviso emergente (`SondeoNotificaciones`): el mismo texto y «Ver» con su clave', () => {
    const s = leer('components/demo/shell/SondeoNotificaciones.tsx')
    expect(s).toContain('const v = traducirNotificacion(n, textos.current.idioma)')
    expect(s).toContain('mostrar(v.titulo, {')
    expect(s).toContain('description: v.detalle ?? undefined')
    expect(s).toContain("label: textos.current.t('notificaciones.ver')")
    expect(s).not.toContain("label: 'Ver'")
  })
})
