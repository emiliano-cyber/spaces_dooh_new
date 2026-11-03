import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ES_ENERGIA, EN_ENERGIA, IT_ENERGIA } from './energia'
import { huellasEnItaliano } from '../guardias-italiano'
import {
  motivoInvalido,
  motivoInvalidoDelRecibo,
  resumenDeCobertura,
  etiquetaDeMes,
  textoDeConfirmacionDeBorrado,
} from '@/components/demo/energia/captura'
import { OPCIONES_MESES, motivoNoConfirmable, textoDeLoLeido } from '@/components/demo/energia/recibos'

// ============================================================================
//  EL DICCIONARIO DE CONSUMO DE LUZ, CONGELADO — y atado a sus fuentes.
// ----------------------------------------------------------------------------
//  Instantanea, guardias de forma, y lo que importa en este modulo: las
//  funciones de `captura.ts` y `recibos.ts` devuelven en espanol EXACTAMENTE
//  lo de siempre con y sin `idioma`, y su espanol coincide con el diccionario.
//  Y los avisos que no se rinden (errores de red y del servidor) usan su clave.
// ============================================================================

const ES = ES_ENERGIA as Record<string, string>
const EN = EN_ENERGIA as Record<string, string>
const leer = (f: string) => readFileSync(path.join(__dirname, '../../..', f), 'utf8')

describe('diccionario de ENERGIA · instantanea', () => {
  it('el ESPANOL no cambia sin que se vea', () => {
    expect(ES_ENERGIA).toMatchSnapshot()
  })
  it('el INGLES tampoco', () => {
    expect(EN_ENERGIA).toMatchSnapshot()
  })
})

describe('diccionario de ENERGIA · el ingles no esta en espanol', () => {
  const IGUALES = new Set<string>(['energia.resumen']) // solo huecos: «{meses} · {puntos}»

  it('ninguna entrada inglesa es igual a la espanola, salvo las declaradas', () => {
    expect(Object.keys(ES).filter((k) => ES[k] === EN[k] && !IGUALES.has(k))).toEqual([])
  })
  it('ninguna entrada inglesa lleva acentos, ñ ni signos de apertura', () => {
    expect(Object.entries(EN).filter(([, v]) => /[áéíóúñÁÉÍÓÚÑ¿¡]/.test(v)).map(([k]) => k)).toEqual([])
  })
  it('en ingles ningun porcentaje lleva espacio antes del «%»', () => {
    expect(Object.entries(EN).filter(([, v]) => /\s%/.test(v)).map(([k]) => k)).toEqual([])
  })
  it('apostrofo tipografico, comillas curvas y nunca «Tap» ni «press»', () => {
    expect(Object.entries(EN).filter(([, v]) => /[A-Za-z]'[A-Za-z]|(^|[\s(])"|\b(tap|press)\b/i.test(v)).map(([k]) => k)).toEqual([])
  })
  it('los huecos son los mismos en los dos idiomas', () => {
    const huecos = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
    expect(Object.keys(ES).filter((k) => huecos(ES[k]) !== huecos(EN[k]))).toEqual([])
  })
  it('todo plural lleva sus dos formas', () => {
    const sueltas = Object.keys(ES).filter(
      (k) => (k.endsWith('.uno') && !(k.replace(/\.uno$/, '.otros') in ES)) || (k.endsWith('.otros') && !(k.replace(/\.otros$/, '.uno') in ES)),
    )
    expect(sueltas).toEqual([])
  })
  it('ninguna cifra de dinero ni simbolo de moneda', () => {
    expect(Object.entries({ ...ES, ...EN }).filter(([, v]) => /\$|MXN|USD|\d,\d{3}/.test(v)).map(([k]) => k)).toEqual([])
  })
})

describe('energia · las opciones de meses espejan `OPCIONES_MESES`', () => {
  it('el espanol de cada opcion es la etiqueta del modulo', () => {
    for (const o of OPCIONES_MESES) expect(ES[`energia.subir.opcion.${o.meses}`]).toBe(o.etiqueta)
    expect(OPCIONES_MESES.map((o) => o.meses)).toEqual([1, 2, 3, 4])
  })
})

describe('energia · `captura.ts` y `recibos.ts`: el espanol no cambia con `idioma`', () => {
  const TABLERO = (extra: Record<string, unknown>) =>
    ({ desde: '2026-01-01', hasta: '2026-02-28', meses: [], puntos: [], celdas: [], esperados: 6, faltantes: 3, huerfanos: [], ...extra }) as never
  const recibo = { id: 'r', periodo: '2026-01-01', medidor: null, kwh: 1, importe: 3400.5 } as never
  const fila = (extra: Record<string, unknown>) => ({ punto: 'P:1', kwh: '10', importe: '20', ...extra }) as never
  const lectura = {
    numeroServicio: '1', medidorFisico: 'A', tarifa: 'PDBT', desde: '2025-11-10', hasta: '2026-01-09', kwh: null, kwhLeido: 1500,
    facturacionPeriodo: 4000, alumbradoPublico: 200, totalDelRecibo: 9000, avisos: [],
  } as never

  const casos: [string, (i?: 'es' | 'en') => unknown][] = [
    ['periodo sin inicio', (i) => motivoInvalido({ desde: '', hasta: '2026-01-31' }, i)],
    ['periodo sin fin', (i) => motivoInvalido({ desde: '2026-01-01', hasta: '' }, i)],
    ['periodo con formato raro', (i) => motivoInvalido({ desde: '2026-13-01', hasta: '2026-01-31' }, i)],
    ['periodo invertido', (i) => motivoInvalido({ desde: '2026-05-01', hasta: '2026-01-31' }, i)],
    ['cobertura con faltantes y huerfanos', (i) => resumenDeCobertura(TABLERO({ huerfanos: [recibo, recibo] }), i)],
    ['cobertura completa', (i) => resumenDeCobertura(TABLERO({ faltantes: 0, huerfanos: [recibo] }), i)],
    ['cobertura completa de uno', (i) => resumenDeCobertura(TABLERO({ esperados: 1, faltantes: 0 }), i)],
    ['cobertura sin puntos', (i) => resumenDeCobertura(TABLERO({ esperados: 0, faltantes: 0 }), i)],
    ['mes', (i) => etiquetaDeMes('2026-02', i)],
    ['borrado sin medidor', (i) => textoDeConfirmacionDeBorrado(recibo, i)],
    ['recibo sin punto', (i) => motivoInvalidoDelRecibo({ punto: '', periodo: '2026-01', kwh: '1', importe: '1' }, new Date(2026, 1, 1), i)],
    ['recibo sin mes', (i) => motivoInvalidoDelRecibo({ punto: 'P:1', periodo: '', kwh: '1', importe: '1' }, new Date(2026, 1, 1), i)],
    ['recibo sin kwh', (i) => motivoInvalidoDelRecibo({ punto: 'P:1', periodo: '2026-01', kwh: '', importe: '1' }, new Date(2026, 1, 1), i)],
    ['recibo importe raro', (i) => motivoInvalidoDelRecibo({ punto: 'P:1', periodo: '2026-01', kwh: '1', importe: 'x' }, new Date(2026, 1, 1), i)],
    ['recibo importe cero', (i) => motivoInvalidoDelRecibo({ punto: 'P:1', periodo: '2026-01', kwh: '1', importe: '0' }, new Date(2026, 1, 1), i)],
    ['recibo del futuro', (i) => motivoInvalidoDelRecibo({ punto: 'P:1', periodo: '2026-05', kwh: '1', importe: '1' }, new Date(2026, 1, 1), i)],
    ['fila sin punto', (i) => motivoNoConfirmable(fila({ punto: '' }), i)],
    ['fila sin kwh', (i) => motivoNoConfirmable(fila({ kwh: '' }), i)],
    ['fila con importe raro', (i) => motivoNoConfirmable(fila({ importe: 'x' }), i)],
    ['fila con kwh cero', (i) => motivoNoConfirmable(fila({ kwh: '0' }), i)],
    ['lo leido', (i) => textoDeLoLeido(lectura, i)],
  ]

  // Lote L1 del italiano (2026-11-03): el italiano es OTRO texto que el
  // ingles (no la caida) y no lleva ningun formato espanol ni ingles.
  for (const [nombre, f] of casos) {
    it(`${nombre}: en italiano, otro texto que en ingles y sin formatos ajenos`, () => {
      const g = f as (i?: string) => unknown
      expect(g('it')).not.toEqual(g('en'))
      const texto = JSON.stringify(g('it'))
      expect(texto).not.toMatch(/[¿¡ñ]/)
      expect(huellasEnItaliano(texto)).toEqual([])
    })
  }

  // Validacion L1 (V8): la rama de los kWh ACEPTADOS (no la de «il PDF
  // indica») tambien lleva la cifra en italiano.
  it('lo leido con los kWh aceptados: «1.500 kWh» en italiano, «1,500 kWh» en es y en', () => {
    const aceptado = { ...(lectura as object), kwh: 1500 } as never
    expect(textoDeLoLeido(aceptado, 'it')).toContain(' · 1.500 kWh')
    expect(textoDeLoLeido(aceptado, 'it')).not.toContain('1,500')
    expect(textoDeLoLeido(aceptado, 'en')).toContain(' · 1,500 kWh')
    expect(textoDeLoLeido(aceptado)).toContain(' · 1,500 kWh')
  })

  for (const [nombre, f] of casos) {
    it(`${nombre}: igual con y sin 'es', y otro texto en ingles`, () => {
      expect(f('es')).toEqual(f())
      expect(f('en')).not.toEqual(f())
      expect(JSON.stringify(f('en'))).not.toMatch(/[áéíóúñ]/)
    })
  }

  it('el espanol del diccionario reproduce los literales de las ramas', () => {
    expect(motivoInvalido({ desde: '2026-05-01', hasta: '2026-01-31' })).toBe(ES['energia.motivo.orden'])
    expect(resumenDeCobertura(TABLERO({ esperados: 0, faltantes: 0 })).texto).toBe(ES['energia.cobertura.sin-puntos'])
    expect(motivoNoConfirmable(fila({ kwh: '' }))).toBe(ES['energia.lectura.kwh.falta'])
    expect(motivoInvalidoDelRecibo({ punto: 'P:1', periodo: '2026-01', kwh: 'x', importe: '1' }, new Date(2026, 1, 1))).toBe(ES['energia.motivo.kwh.numero'])
    expect(textoDeConfirmacionDeBorrado(recibo)).toBe(
      ES['energia.borrado.confirmacion'].replace('{medidor}', 'sin número').replace('{mes}', etiquetaDeMes('2026-01')).replace('{monto}', '$3,400.50'),
    )
  })
})

describe('energia · los avisos que no se rinden usan su clave', () => {
  it('la pagina: carga, red, guardar y borrar', () => {
    const s = leer('app/(app)/(shell)/energia/page.tsx')
    expect(s).toMatch(/cuerpo\?\.error \?\? t\('energia\.error\.cargar'\)/)
    expect(s).toMatch(/setErrorCarga\(t\('energia\.error\.contactar'\)\)/)
    expect(s).toMatch(/cuerpo\?\.error \?\? t\('energia\.error\.guardar-recibo'\)/)
    expect(s).toMatch(/cuerpo\?\.error \?\? t\('energia\.error\.borrar-recibo'\)/)
  })
  it('el formulario y la subida', () => {
    expect(leer('components/demo/energia/FormularioRecibo.tsx')).toMatch(/e\.message : t\('energia\.error\.guardar-recibo'\)/)
    const s = leer('components/demo/energia/SubirRecibos.tsx')
    expect(s).toMatch(/datos\?\.error \?\? t\('energia\.subir\.error-leer'\)/)
    expect(s).toMatch(/setError\(t\('energia\.error\.contactar'\)\)/)
    expect(s).toMatch(/cuerpo\?\.error \?\? t\('energia\.subir\.no-guardar'\)/)
    expect(s).toMatch(/\[f\.clave\]: t\('energia\.subir\.no-contactar'\)/)
  })
})

// ============================================================================
//  EL ITALIANO DEL LOTE L1 (2026-11-03): completo, congelado y con la forma
//  de la casa italiana (`vault/03-Frontend/italiano-olas.md`).
// ============================================================================
describe('diccionario de ENERGIA · italiano', () => {
  const IT = IT_ENERGIA as Partial<Record<string, string>>
  const it_ = Object.entries(IT) as [string, string][]
  // Solo huecos, o palabras que en italiano se dicen como en ingles («file»,
  // anglicismo de uso comun en la interfaz italiana).
  const IGUALES_IT = new Set<string>([
    'energia.resumen', // solo huecos
    'energia.lectura.archivo.uno', // «file»
    'energia.lectura.archivo.otros', // «file», invariable
    'energia.kpi.kwh', // «kWh del periodo», igual que el espanol
    'energia.kpi.del-periodo', // «del periodo», igual que el espanol
    'energia.leido.periodo', // «periodo {desde} → {hasta}», igual que el espanol
  ])

  it('esta COMPLETO: cada clave del espanol tiene su italiano, y ninguna sobra', () => {
    expect(Object.keys(ES).filter((k) => !IT[k])).toEqual([])
    expect(Object.keys(IT).filter((k) => !(k in ES))).toEqual([])
  })
  it('no cambia sin que se vea', () => {
    expect(IT_ENERGIA).toMatchSnapshot()
  })
  it('ninguna entrada italiana es igual a la espanola ni a la inglesa, salvo las declaradas', () => {
    expect(it_.filter(([k, v]) => (v === ES[k] || v === EN[k]) && !IGUALES_IT.has(k)).map(([k]) => k)).toEqual([])
  })
  it('los huecos son los mismos que en espanol', () => {
    const huecos = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
    expect(it_.filter(([k, v]) => huecos(v) !== huecos(ES[k])).map(([k]) => k)).toEqual([])
  })
  it('sin espacio antes del «%», apostrofo tipografico, sin signos espanoles', () => {
    expect(it_.filter(([, v]) => /\s%|[A-Za-zÀ-ú]'[A-Za-zÀ-ú]|"|[¿¡ñ]/.test(v)).map(([k]) => k)).toEqual([])
  })
  it('las periodicidades en letra: «ogni due mesi», nunca «bimestrale» (ambiguo) ni «ogni 2»', () => {
    expect(it_.filter(([, v]) => /bimestral|\bogni \d/i.test(v)).map(([k]) => k)).toEqual([])
  })
  it('glosario de la validacion: predio → immobile, punto de medicion → punto di prelievo (POD)', () => {
    expect(it_.filter(([, v]) => /propriet|punt[oi] di misura/i.test(v)).map(([k]) => k)).toEqual([])
  })
  it('ninguna cifra de dinero ni simbolo de moneda', () => {
    expect(it_.filter(([, v]) => /\$|MXN|USD|\beuro\b|\bpesos?\b|\d\.\d{3}/.test(v)).map(([k]) => k)).toEqual([])
  })
})
