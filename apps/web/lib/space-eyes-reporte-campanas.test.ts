import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import {
  rangoDelReporte,
  limitesUTC,
  armarDetecciones,
  resumirDetecciones,
  construirLibroDetecciones,
  deteccionesDeDemostracion,
  nombreArchivoReporte,
  serialExcel,
  type FotoDeteccionSE,
} from './space-eyes-reporte-campanas'

// ============================================================================
//  El reporte en Excel de las campañas que Space Eye DETECTÓ al aire.
// ----------------------------------------------------------------------------
//  Lo que de verdad hay que acertar, y por eso va primero y en rojo:
//   · la HORA: Space Eye la da en UTC y quien lee el reporte vive en México;
//     a las 18:00 de México el día UTC ya es el siguiente;
//   · el RANGO: el día que eligió el usuario es SU día, no el de Greenwich;
//   · que la fecha sea FECHA de Excel (número con formato), no un texto que
//     no se puede ordenar ni filtrar;
//   · y que la demostración diga que lo es, dentro del propio archivo: un
//     Excel se reenvía, y la pantalla que lo rodeaba ya no viaja con él.
// ============================================================================

const ZONA = 'America/Mexico_City'
// 19/11/2026 14:05 en México = 20:05 UTC (México sin horario de verano).
const AHORA = new Date('2026-11-19T20:05:00Z')

const CAMPANAS = [
  { id: 7, name: 'Verano refrescante', advertiser: 'Bebidas del Norte', origen: 'spaceos:demo' },
  { id: 8, name: 'Sin cliente', advertiser: null, origen: null },
]
const EQUIPOS = [
  { id: 1, name: 'Cámara Reforma', billboard_code: 'REF-01' },
  { id: 2, name: 'Cámara Periférico', billboard_code: null },
]
const SITIOS = new Map([['ref-01', 'Reforma 222 · Cara A']])

const foto = (p: Partial<FotoDeteccionSE>): FotoDeteccionSE => ({
  id: 1,
  device_id: 1,
  campaign_id: 7,
  taken_at: '2026-11-03T00:30:00.000Z',
  device_name: 'Cámara Reforma',
  campaign_name: 'Verano refrescante',
  verification_status: 'pending',
  is_correct: null,
  ...p,
})

describe('rango del reporte', () => {
  it('sin fechas: el mes en curso EN LA ZONA del negocio, y lo dice', () => {
    expect(rangoDelReporte({}, AHORA, ZONA)).toEqual({ ok: true, desde: '2026-11-01', hasta: '2026-11-30', porOmision: true })
  })

  it('el 1.º de mes a las 19:00 de México todavía es el mes anterior (en UTC ya no)', () => {
    const r = rangoDelReporte({}, new Date('2026-12-01T01:00:00Z'), ZONA)
    expect(r).toMatchObject({ desde: '2026-11-01', hasta: '2026-11-30' })
  })

  it('con fechas, las respeta', () => {
    expect(rangoDelReporte({ desde: '2026-11-03', hasta: '2026-11-05' }, AHORA, ZONA)).toEqual({
      ok: true,
      desde: '2026-11-03',
      hasta: '2026-11-05',
      porOmision: false,
    })
  })

  it('solo una de las dos: la otra sale del mismo día', () => {
    expect(rangoDelReporte({ desde: '2026-11-03' }, AHORA, ZONA)).toMatchObject({ desde: '2026-11-03', hasta: '2026-11-03' })
  })

  it('rechaza fechas mal escritas, al revés o un rango de más de un año', () => {
    expect(rangoDelReporte({ desde: '03/11/2026' }, AHORA, ZONA).ok).toBe(false)
    expect(rangoDelReporte({ desde: '2026-02-30', hasta: '2026-03-01' }, AHORA, ZONA).ok).toBe(false)
    expect(rangoDelReporte({ desde: '2026-11-05', hasta: '2026-11-03' }, AHORA, ZONA).ok).toBe(false)
    expect(rangoDelReporte({ desde: '2025-01-01', hasta: '2026-11-03' }, AHORA, ZONA).ok).toBe(false)
  })

  it('los límites que se le piden a Space Eye van en UTC: el día de México empieza a las 06:00 UTC', () => {
    expect(limitesUTC({ desde: '2026-11-03', hasta: '2026-11-05' }, ZONA)).toEqual({
      desde: '2026-11-03 06:00:00',
      hasta: '2026-11-06 05:59:59',
    })
  })
})

describe('filas de detecciones', () => {
  it('pone la fecha y la hora de MÉXICO, no las de UTC', () => {
    // 00:30 UTC del 3 = 18:30 del 2 en México.
    const [f] = armarDetecciones([foto({})], { campanas: CAMPANAS, equipos: EQUIPOS, sitiosPorCodigo: SITIOS, zona: ZONA })
    expect(f.fechaLocal).toBe('2026-11-02')
    expect(f.horaLocal).toBe('18:30:00')
  })

  it('completa cliente, equipo, código y sitio con lo que se conoce, sin inventar', () => {
    const filas = armarDetecciones(
      [foto({ id: 1 }), foto({ id: 2, device_id: 2, campaign_id: 8, device_name: 'Cámara Periférico', campaign_name: 'Sin cliente' })],
      { campanas: CAMPANAS, equipos: EQUIPOS, sitiosPorCodigo: SITIOS, zona: ZONA },
    )
    expect(filas[0]).toMatchObject({
      campana: 'Verano refrescante',
      cliente: 'Bebidas del Norte',
      equipo: 'Cámara Reforma',
      codigo: 'REF-01',
      sitio: 'Reforma 222 · Cara A',
      deOperaciones: true,
    })
    expect(filas[1]).toMatchObject({ campana: 'Sin cliente', cliente: '', codigo: '', sitio: '', deOperaciones: false })
  })

  it('ordena de la más vieja a la más nueva y descarta lo que no es de una campaña', () => {
    const filas = armarDetecciones(
      [
        foto({ id: 1, taken_at: '2026-11-05T15:00:00Z' }),
        foto({ id: 2, taken_at: '2026-11-04T15:00:00Z' }),
        foto({ id: 3, campaign_id: null, taken_at: '2026-11-03T15:00:00Z' }),
      ],
      { campanas: CAMPANAS, equipos: EQUIPOS, sitiosPorCodigo: SITIOS, zona: ZONA },
    )
    expect(filas.map((f) => f.id)).toEqual([2, 1])
  })

  it('el resumen agrupa por campaña y equipo: primera, última y cuántas', () => {
    const filas = armarDetecciones(
      [
        foto({ id: 1, taken_at: '2026-11-05T15:00:00Z' }),
        foto({ id: 2, taken_at: '2026-11-04T15:00:00Z' }),
        foto({ id: 3, device_id: 2, taken_at: '2026-11-04T16:00:00Z' }),
      ],
      { campanas: CAMPANAS, equipos: EQUIPOS, sitiosPorCodigo: SITIOS, zona: ZONA },
    )
    const r = resumirDetecciones(filas)
    expect(r).toHaveLength(2)
    const reforma = r.find((x) => x.equipo === 'Cámara Reforma')!
    expect(reforma.detecciones).toBe(2)
    expect(reforma.primera.cuando).toBe('2026-11-04T15:00:00Z')
    expect(reforma.ultima.cuando).toBe('2026-11-05T15:00:00Z')
  })
})

describe('serial de Excel', () => {
  it('es el número de días desde 1899-12-30, con la hora como fracción', () => {
    expect(serialExcel('2026-11-02', '18:30:00')).toBeCloseTo(46328 + 18.5 / 24, 8)
    expect(serialExcel('1900-03-01', '00:00:00')).toBe(61)
  })
})

describe('el libro', () => {
  const filas = armarDetecciones(
    [foto({ id: 1 }), foto({ id: 2, taken_at: '2026-11-04T15:10:05Z', verification_status: 'verified', is_correct: 1 })],
    { campanas: CAMPANAS, equipos: EQUIPOS, sitiosPorCodigo: SITIOS, zona: ZONA },
  )
  const leer = (opts: Partial<Parameters<typeof construirLibroDetecciones>[0]> = {}) => {
    const datos = construirLibroDetecciones({
      filas,
      rango: { desde: '2026-11-01', hasta: '2026-11-30', porOmision: true },
      ahora: AHORA,
      zona: ZONA,
      idioma: 'es',
      demostracion: false,
      truncado: false,
      filtros: {},
      ...opts,
    })
    // `cellNF`: que lea el formato de número que viajó DENTRO del archivo.
    return XLSX.read(datos, { type: 'array', cellNF: true })
  }
  const celdas = (h: XLSX.WorkSheet) => XLSX.utils.sheet_to_json<unknown[]>(h, { header: 1, raw: true, defval: null })

  it('trae dos hojas: las detecciones una por una y el resumen', () => {
    expect(leer().SheetNames).toEqual(['Detecciones', 'Resumen'])
  })

  it('arriba: título, periodo (avisando que es el mes en curso), generado y zona', () => {
    const h = leer().Sheets['Detecciones']
    const t = celdas(h).slice(0, 4).map((r) => String(r[0]))
    expect(t[0]).toBe('Campañas detectadas por Space Eyes')
    expect(t[1]).toContain('01/11/2026')
    expect(t[1]).toContain('30/11/2026')
    expect(t[1]).toContain('mes en curso')
    expect(t[2]).toContain('19/11/2026 14:05')
    expect(t[2]).toContain(ZONA)
  })

  it('fecha y hora son NÚMEROS con formato de fecha, no texto', () => {
    const h = leer().Sheets['Detecciones']
    const filasHoja = celdas(h)
    const iCab = filasHoja.findIndex((r) => r[0] === 'Fecha')
    expect(filasHoja[iCab]).toEqual([
      'Fecha',
      'Hora',
      'Campaña',
      'Cliente',
      'Equipo',
      'Código de pantalla',
      'Sitio',
      'Verificación',
      'Resultado',
      'Origen de la campaña',
    ])
    const dir = (c: number, r: number) => XLSX.utils.encode_cell({ c, r })
    const fecha = h[dir(0, iCab + 1)]
    const hora = h[dir(1, iCab + 1)]
    expect(fecha.t).toBe('n')
    expect(fecha.v).toBe(46328) // 02/11/2026
    expect(fecha.z).toBe('dd/mm/yyyy')
    expect(hora.t).toBe('n')
    expect(hora.v).toBeCloseTo(18.5 / 24, 8)
    expect(hora.z).toBe('hh:mm:ss')
    // La segunda: verificada y correcta, traducido.
    expect(filasHoja[iCab + 2].slice(7)).toEqual(['Verificada', 'Correcta', 'De Operaciones'])
  })

  it('en inglés: cabeceras en inglés y la fecha mes/día', () => {
    const libro = leer({ idioma: 'en' })
    expect(libro.SheetNames).toEqual(['Detections', 'Summary'])
    const h = libro.Sheets['Detections']
    const filasHoja = celdas(h)
    const iCab = filasHoja.findIndex((r) => r[0] === 'Date')
    expect(filasHoja[iCab].slice(0, 4)).toEqual(['Date', 'Time', 'Campaign', 'Client'])
    expect(h[XLSX.utils.encode_cell({ c: 0, r: iCab + 1 })].z).toBe('mm/dd/yyyy')
  })

  it('en italiano y en portugués también', () => {
    expect(leer({ idioma: 'it' }).SheetNames).toEqual(['Rilevamenti', 'Riepilogo'])
    expect(leer({ idioma: 'pt' }).SheetNames).toEqual(['Detecções', 'Resumo'])
  })

  it('el resumen trae primera y última como fecha y hora de Excel, y el número de detecciones', () => {
    const h = leer().Sheets['Resumen']
    const filasHoja = celdas(h)
    const iCab = filasHoja.findIndex((r) => r[0] === 'Campaña')
    expect(filasHoja[iCab]).toEqual([
      'Campaña',
      'Cliente',
      'Equipo',
      'Código de pantalla',
      'Sitio',
      'Primera detección',
      'Última detección',
      'Detecciones',
    ])
    const primera = h[XLSX.utils.encode_cell({ c: 5, r: iCab + 1 })]
    expect(primera.t).toBe('n')
    expect(primera.z).toBe('dd/mm/yyyy hh:mm')
    expect(filasHoja[iCab + 1][7]).toBe(2)
  })

  it('la demostración lo dice DENTRO del archivo', () => {
    const t = celdas(leer({ demostracion: true }).Sheets['Detecciones']).slice(0, 6).map((r) => String(r[0] ?? ''))
    expect(t.some((x) => /DEMOSTRACIÓN/.test(x))).toBe(true)
    const real = celdas(leer().Sheets['Detecciones']).slice(0, 6).map((r) => String(r[0] ?? ''))
    expect(real.some((x) => /DEMOSTRACIÓN/.test(x))).toBe(false)
  })

  it('si Space Eye tenía más de lo que cabe, lo avisa en vez de cortar en silencio', () => {
    const t = celdas(leer({ truncado: true }).Sheets['Detecciones']).slice(0, 6).map((r) => String(r[0] ?? ''))
    expect(t.some((x) => /incompleto/i.test(x))).toBe(true)
  })

  it('los filtros elegidos quedan escritos', () => {
    const t = celdas(leer({ filtros: { equipo: 'Cámara Reforma', campana: 'Verano refrescante' } }).Sheets['Detecciones'])
      .slice(0, 6)
      .map((r) => String(r[0] ?? ''))
    expect(t.some((x) => x.includes('Cámara Reforma') && x.includes('Verano refrescante'))).toBe(true)
  })

  it('sin detecciones, el libro sale igual con su cabecera y una línea que lo dice', () => {
    const h = construirLibroDetecciones({
      filas: [],
      rango: { desde: '2026-11-01', hasta: '2026-11-30', porOmision: false },
      ahora: AHORA,
      zona: ZONA,
      idioma: 'es',
      demostracion: false,
      truncado: false,
      filtros: {},
    })
    const libro = XLSX.read(h, { type: 'array' })
    const t = celdas(libro.Sheets['Detecciones']).map((r) => String(r[0] ?? ''))
    expect(t.some((x) => /Ninguna detección/.test(x))).toBe(true)
  })
})

describe('la demostración', () => {
  it('es determinista, cae dentro del rango y no pasa de hoy', () => {
    const rango = { desde: '2026-11-01', hasta: '2026-11-30' }
    const a = deteccionesDeDemostracion(rango, ZONA, 'es', AHORA)
    const b = deteccionesDeDemostracion(rango, ZONA, 'es', AHORA)
    expect(a).toEqual(b)
    expect(a.fotos.length).toBeGreaterThan(0)
    const filas = armarDetecciones(a.fotos, { campanas: a.campanas, equipos: a.equipos, sitiosPorCodigo: new Map(), zona: ZONA })
    for (const f of filas) {
      expect(f.fechaLocal >= '2026-11-01').toBe(true)
      expect(f.fechaLocal <= '2026-11-19').toBe(true)
      expect(new Date(f.cuando).getTime()).toBeLessThanOrEqual(AHORA.getTime())
    }
  })

  it('respeta el filtro de equipo y de campaña', () => {
    const rango = { desde: '2026-11-01', hasta: '2026-11-10' }
    const todo = deteccionesDeDemostracion(rango, ZONA, 'es', AHORA)
    const equipo = todo.equipos[0].id
    const campana = todo.campanas[0].id
    const f = deteccionesDeDemostracion(rango, ZONA, 'es', AHORA, { equipo, campana })
    expect(f.fotos.length).toBeGreaterThan(0)
    expect(f.fotos.every((p) => p.device_id === equipo && p.campaign_id === campana)).toBe(true)
  })

  it('los nombres de ejemplo van en el idioma de quien lo pide', () => {
    const es = deteccionesDeDemostracion({ desde: '2026-11-01', hasta: '2026-11-02' }, ZONA, 'es', AHORA)
    const en = deteccionesDeDemostracion({ desde: '2026-11-01', hasta: '2026-11-02' }, ZONA, 'en', AHORA)
    expect(es.equipos[0].name).not.toBe(en.equipos[0].name)
  })
})

describe('nombre del archivo', () => {
  it('lleva el rango y, si es de ejemplo, lo dice', () => {
    expect(nombreArchivoReporte({ desde: '2026-11-01', hasta: '2026-11-30' }, false)).toBe(
      'space-eyes-campanas-detectadas-2026-11-01-a-2026-11-30.xlsx',
    )
    expect(nombreArchivoReporte({ desde: '2026-11-01', hasta: '2026-11-30' }, true)).toBe(
      'space-eyes-campanas-detectadas-2026-11-01-a-2026-11-30-demostracion.xlsx',
    )
  })
})
