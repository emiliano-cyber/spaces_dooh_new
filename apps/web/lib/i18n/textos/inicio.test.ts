import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ES_INICIO, EN_INICIO } from './inicio'
import { traducir } from '../diccionario'
import { TIPOS_ALERTA } from '@/lib/alertas-visibles'
import { TRAMOS_COBRANZA, pipelineComercial } from '@/components/demo/inicio/indicadores'
import { CLAVE_INCIDENCIA, CLAVE_LICENCIA, LICENCIA_LABEL, dashboardMetrics } from '@/lib/data/derive'
import { ESTADO_ALERTAS } from '../estado-alertas.fixture'

// ============================================================================
//  EL DICCIONARIO DEL DASHBOARD, CONGELADO — y atado a sus fuentes.
// ----------------------------------------------------------------------------
//  Instantanea de los dos idiomas, las guardias de forma de los otros lotes y
//  los espejos de las tablas espanolas que el lote NO toca (`TIPOS_ALERTA`,
//  `TRAMOS_COBRANZA`, `LICENCIA_LABEL`, `GRANS`). Y las alertas de
//  `construirAlertas`: en espanol, el MISMO texto con y sin `idioma`.
// ============================================================================

const ES = ES_INICIO as Record<string, string>
const EN = EN_INICIO as Record<string, string>
const FUENTE = readFileSync(path.join(__dirname, '../../../app/(app)/(shell)/inicio/page.tsx'), 'utf8')

describe('diccionario de INICIO · instantanea', () => {
  it('el ESPANOL no cambia sin que se vea', () => {
    expect(ES_INICIO).toMatchSnapshot()
  })
  it('el INGLES tampoco', () => {
    expect(EN_INICIO).toMatchSnapshot()
  })
})

describe('diccionario de INICIO · el ingles no esta en espanol', () => {
  const IGUALES = new Set<string>([
    'inicio.pipeline-sub', // solo huecos: «{propuestas} · {enviadas}»
    'inicio.costo.total', // «Total» es la misma palabra
    'inicio.leyenda.digital', // «Digital» es la misma palabra
  ])

  it('ninguna entrada inglesa es igual a la espanola, salvo las declaradas', () => {
    expect(Object.keys(ES).filter((k) => ES[k] === EN[k] && !IGUALES.has(k))).toEqual([])
  })
  it('las declaradas siguen siendo iguales', () => {
    expect([...IGUALES].filter((k) => ES[k] !== EN[k])).toEqual([])
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

describe('inicio · espejos de las tablas espanolas', () => {
  it('cada tipo de alerta dice en espanol lo mismo que `TIPOS_ALERTA`', () => {
    for (const { tipo, label } of TIPOS_ALERTA) expect(ES[`inicio.tipo-alerta.${tipo}`]).toBe(label)
  })
  it('cada tramo dice en espanol lo mismo que `TRAMOS_COBRANZA`', () => {
    for (const { clave, label } of TRAMOS_COBRANZA) expect(ES[`inicio.tramo.${clave.replace('_', '-')}`]).toBe(label)
  })
  it('cada licencia dice en espanol lo mismo que `LICENCIA_LABEL`', () => {
    expect(Object.keys(CLAVE_LICENCIA).sort()).toEqual(Object.keys(LICENCIA_LABEL).sort())
    for (const [k, v] of Object.entries(LICENCIA_LABEL)) expect(traducir('es', CLAVE_LICENCIA[k])).toBe(v)
  })
  it('cada tipo de incidencia (enum `TipoIncidencia`) tiene su clave, y su espanol es el dato en minusculas', () => {
    const tipos = ['CLIMA', 'MANTENIMIENTO', 'LEGAL', 'VANDALISMO', 'SUSPENSION_OPERATIVA', 'ACCIDENTE', 'OTRO']
    expect(Object.keys(CLAVE_INCIDENCIA).sort()).toEqual([...tipos].sort())
    for (const t of tipos) expect(traducir('es', CLAVE_INCIDENCIA[t])).toBe(t.toLowerCase())
  })
  it('el selector de granularidad dice en espanol lo mismo que `GRANS`', () => {
    for (const [g, label] of [['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes']]) {
      expect(ES[`inicio.gran.${g}`]).toBe(label)
      expect(FUENTE).toContain(`{ value: '${g}', label: '${label}' }`)
    }
  })
})

describe('inicio · las alertas de `construirAlertas`', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 2, 12))
  })
  afterEach(() => vi.useRealTimers())

  const alertas = (idioma?: 'es' | 'en') => dashboardMetrics(ESTADO_ALERTAS as never, new Date(), idioma).alertas

  it('en espanol, el MISMO texto con y sin `idioma` (los llamadores de siempre no cambian)', () => {
    const sin = alertas()
    expect(sin.length).toBeGreaterThan(20)
    expect(alertas('es')).toEqual(sin)
  })

  it('en ingles, las mismas alertas (ids, tipos, niveles) y ninguna palabra espanola', () => {
    const es = alertas('es')
    const en = alertas('en')
    expect(en.map((a) => [a.id, a.tipo, a.nivel])).toEqual(es.map((a) => [a.id, a.tipo, a.nivel]))
    // Los datos de prueba (nombres de sitio, el tipo de incidencia en minusculas
    // y el motivo de la pausa) son datos: se quitan antes de buscar.
    const limpio = en
      .map((a) => `${a.titulo}\n${a.detalle}`)
      .join('\n')
      .replace(/Pantalla Reforma|Pantalla Sur|Valla Norte|Valla Centro|clausura-municipal|vandalismo|otro|Verano/g, '')
    expect(limpio).not.toMatch(/[áéíóúñ]|\b(vence|venció|cuotas?|sin liquidar|hace|días?|Sitio|Factura|Contrato|Licencia|Permiso|campaña|sin asignar|sin sitio)\b/)
    expect(limpio).toContain('MX$')
  })

  it('el espanol del diccionario reproduce el literal de cada rama', () => {
    const es = alertas('es').map((a) => `${a.titulo} | ${a.detalle}`)
    const debe = [
      `${ES['inicio.alerta.renta-vencida']} | Pantalla Reforma — 2 cuotas sin liquidar desde 2026-09-01 ($ 2,000.00)`,
      `${ES['inicio.alerta.contrato-incompleto']} | ${ES['inicio.alerta.contrato-incompleto.detalle'].replace('{sitio}', 'Valla Norte')}`,
      `${ES['inicio.alerta.ot-vencida']} | ${ES['inicio.alerta.ot-vencio.uno'].replace('{folio}', 'OT-1').replace('{sitio}', 'Pantalla Reforma').replace('{n}', '1').replace('{sinAsignar}', ES['inicio.alerta.ot-sin-asignar'])}`,
    ]
    for (const d of debe) expect(es).toContain(d)
  })
})

describe('inicio · el resto de la pagina', () => {
  it('«Otros vendedores» / «Sin vendedor» salen en el idioma que se pide; en espanol como siempre', () => {
    const p = [
      { estatus: 'APROBADA', neto: 1, aprobadaEn: '2026-11-02T12:00:00', vendedorId: null },
      { estatus: 'APROBADA', neto: 1, aprobadaEn: '2026-11-02T12:00:00', vendedorId: 'x' },
    ]
    const hoy = new Date(2026, 10, 2, 12)
    expect(pipelineComercial(p, [], hoy).porVendedor.map((v) => v.nombre).sort()).toEqual(['Otros vendedores', 'Sin vendedor'])
    expect(pipelineComercial(p, [], hoy, null, 'en').porVendedor.map((v) => v.nombre).sort()).toEqual(['No sales rep', 'Other sales reps'])
  })

  it('la pagina pide las metricas y el pipeline EN su idioma, y el mes con el locale del idioma', () => {
    expect(FUENTE).toContain('const m = useDashboard(idioma)')
    expect(FUENTE).toContain('pipelineComercial(propuestas, usuarios ?? [], hoy, yo, idioma)')
    // Ola 0 del italiano: el locale sale de `formato-idioma.ts`, ya no de una bifurcacion es/en.
    expect(FUENTE).toContain("hoy.toLocaleDateString(localeDe(idioma), { month: 'long' })")
  })

  it('el menu de configurar alertas (se monta en un portal y no se rinde) usa sus claves', () => {
    expect(FUENTE).toContain("{t('inicio.alertas-a-mostrar')}")
    expect(FUENTE).toContain('{t(CLAVE_TIPO_ALERTA[ta.tipo])}')
  })
})
