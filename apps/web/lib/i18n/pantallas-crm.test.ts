import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProveedorIdioma } from './contexto'
import type { Idioma } from './idiomas'
import { ES_CRM } from './textos/crm'
import { DICCIONARIOS } from './diccionario'
import { CotejoPorCliente } from '@/components/demo/propuestas/CotejoPorCliente'
import type { Propuesta } from '@/lib/data/client'

// ============================================================================
//  El cotejo por cliente (CRM, Fase 1 del ADR 0051), rendido de verdad.
// ----------------------------------------------------------------------------
//  Mismo patrón que `pantallas-propuestas.test.ts`: el componente REAL dentro
//  del proveedor de idioma, a HTML con `renderToStaticMarkup`. Comprueba que en
//  español salen las cifras del cotejo y que en los otros tres idiomas no se
//  cuela ninguna frase española del área.
// ============================================================================

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  usePathname: () => '/propuestas',
  useSearchParams: () => new URLSearchParams(),
}))

const prop = (o: Partial<Propuesta> & Pick<Propuesta, 'id'>): Propuesta =>
  ({
    folio: o.id.toUpperCase(),
    nombre: `Campaña ${o.id}`,
    clienteId: 'c1',
    agenciaId: null,
    estatus: 'ENVIADA',
    version: 1,
    creadoEn: '2026-11-01T18:00:00.000Z',
    aprobadaEn: null,
    rechazadaEn: null,
    vendedorNombre: 'Ana',
    total: 1160,
    totalAprobado: 0,
    items: [],
    ...o,
  }) as Propuesta

const PROPS = [
  prop({ id: 'p1', version: 3 }),
  prop({ id: 'p2', estatus: 'APROBADA', aprobadaEn: '2026-11-05T18:00:00.000Z', totalAprobado: 2320 }),
  prop({ id: 'p3', clienteId: null }),
]
const CLIENTES = [{ id: 'c1', nombre: 'Refrescos del Norte' }] as any

const rendir = (idioma: Idioma) =>
  renderToStaticMarkup(
    createElement(ProveedorIdioma, { idioma, puedeElegir: true }, createElement(CotejoPorCliente, { propuestas: PROPS, clientes: CLIENTES })),
  )

describe('CotejoPorCliente', () => {
  it('en español: un grupo por cliente, con sus cotizaciones y renegociaciones', () => {
    const html = rendir('es')
    expect(html).toContain('Refrescos del Norte')
    expect(html).toContain('Sin cliente')
    expect(html).toContain('Cotizaciones')
    expect(html).toContain('Renegociaciones')
    expect(html).toContain('En negociación')
    expect(html).toContain('2 clientes')
  })

  it('sin propuestas, el aviso y no una tabla vacía', () => {
    const html = renderToStaticMarkup(
      createElement(ProveedorIdioma, { idioma: 'es', puedeElegir: true }, createElement(CotejoPorCliente, { propuestas: [], clientes: [] })),
    )
    expect(html).toContain(ES_CRM['crm.cotejo.vacio'])
  })

  // Las frases que se pintan en el estado de arriba; las que comparten
  // palabra con otro idioma («Vendedores» en pt) se dejan fuera a propósito.
  const ESPANOL = [
    ES_CRM['crm.cotejo.col.cotizaciones'],
    ES_CRM['crm.cotejo.col.renegociaciones'],
    ES_CRM['crm.cotejo.col.dias'],
    ES_CRM['crm.cotejo.col.en-juego'],
    ES_CRM['crm.cotejo.col.ganado'],
    ES_CRM['crm.cotejo.col.cierre'],
    ES_CRM['crm.cotejo.sin-cliente'],
    'Primera cotización',
    'Última actividad',
  ]

  for (const idioma of ['en', 'it', 'pt'] as Idioma[]) {
    it(`en ${idioma} no queda ninguna frase española del cotejo`, () => {
      const html = rendir(idioma)
      expect(ESPANOL.filter((f) => html.includes(f))).toEqual([])
      expect(html).toContain('Refrescos del Norte')
    })
  }
})

// ─── Fase 4 · la pantalla del CRM ───────────────────────────────────────────
import { Oportunidades } from '@/components/demo/crm/Oportunidades'
import { FichaOportunidad } from '@/components/demo/crm/FichaOportunidad'
import { PestanasCrm } from '@/components/demo/crm/PestanasCrm'
import type { FichaOportunidad as Ficha, Oportunidad, PaginaOportunidades } from '@/lib/data/oportunidades-api'

const op = (o: Partial<Oportunidad> & Pick<Oportunidad, 'id' | 'etapa'>): Oportunidad => ({
  nombre: `Oportunidad ${o.id}`,
  prospectoId: null,
  prospectoNombre: null,
  clienteId: 'c1',
  clienteNombre: 'Refrescos del Norte',
  usuarioId: 'u1',
  vendedorNombre: 'Ana',
  presupuestoMin: 100000,
  presupuestoMax: 200000,
  fechaInicioDeseada: '2026-12-01',
  fechaFinDeseada: '2026-12-31',
  fechaDecision: '2026-11-25',
  plazas: 'Monterrey',
  tiposMedio: ['ESPECTACULAR'],
  objetivo: 'Lanzamiento',
  motivoPerdida: null,
  ganadaEn: null,
  perdidaEn: null,
  cotizaciones: 1,
  ultimaActividadEn: null,
  creadoEn: '2026-11-01T18:00:00.000Z',
  actualizadoEn: '2026-11-02T18:00:00.000Z',
  ...o,
})

const PAGINA: PaginaOportunidades = {
  oportunidades: [op({ id: 'o1', etapa: 'COTIZANDO' }), op({ id: 'o2', etapa: 'CONTACTO', presupuestoMin: null, presupuestoMax: null })],
  total: 2,
  porEtapa: { COTIZANDO: 1, CONTACTO: 1 },
  pagina: 1,
  porPagina: 100,
  veTodas: false,
}

const FICHA: Ficha = {
  ...op({ id: 'o1', etapa: 'NEGOCIANDO' }),
  actividades: [
    { id: 'a1', tipo: 'ETAPA', usuarioNombre: 'Ana', nota: null, etapaAnterior: null, etapaNueva: 'CONTACTO', siguientePaso: null, siguientePasoFecha: null, creadoEn: '2026-11-01T18:00:00.000Z' },
    { id: 'a2', tipo: 'LLAMADA', usuarioNombre: 'Ana', nota: 'Pidió precios', etapaAnterior: null, etapaNueva: null, siguientePaso: 'Mandar propuesta', siguientePasoFecha: null, creadoEn: '2026-11-02T18:00:00.000Z' },
    { id: 'a3', tipo: 'ETAPA', usuarioNombre: 'Ana', nota: null, etapaAnterior: 'CONTACTO', etapaNueva: 'NEGOCIANDO', siguientePaso: null, siguientePasoFecha: null, creadoEn: '2026-11-04T18:00:00.000Z' },
  ],
  propuestas: [{ id: 'p1', folio: 'P1', nombre: 'Navidad', estatus: 'ENVIADA', version: 2, creadoEn: '2026-11-03T18:00:00.000Z' }],
  cambios: [
    { id: 'c1', propuestaId: 'p1', folio: 'P1', version: 2, usuarioNombre: 'Luis', origen: 'APP', accion: 'EDITAR', campo: 'descuento_pct', valorAnterior: 5, valorNuevo: 10, creadoEn: '2026-11-05T18:00:00.000Z' },
    { id: 'c2', propuestaId: 'p1', folio: 'P1', version: 1, usuarioNombre: 'Ana', origen: 'APP', accion: 'CREAR', campo: null, valorAnterior: null, valorNuevo: {}, creadoEn: '2026-11-03T18:00:00.000Z' },
  ],
  avancesProspecto: [],
}

const PROP_LIGADA = prop({
  id: 'p1',
  oportunidadId: 'o1',
  // Un cliente de la frontera, con IVA del 8 %: el cotejo usa la tasa de cada
  // empresa, no un 16 fijo. 210 000 sin IVA + 16 800 = 226 800 con IVA.
  base: 210000,
  iva: 16800,
  ivaPct: 8,
  total: 226800,
  items: [{ fechaInicio: '2026-12-01', fechaFin: '2026-12-31' }] as any,
})

const envolver = (idioma: Idioma, hijo: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(ProveedorIdioma, { idioma, puedeElegir: true }, hijo))

const pantallas = (idioma: Idioma) => [
  envolver(idioma, createElement(PestanasCrm, { activa: 'embudo' })),
  envolver(idioma, createElement(Oportunidades, { vista: 'embudo', inicial: PAGINA })),
  envolver(idioma, createElement(Oportunidades, { vista: 'oportunidades', inicial: PAGINA })),
  envolver(idioma, createElement(FichaOportunidad, {
    id: 'o1', inicial: FICHA, propuestasInicial: [PROP_LIGADA], ahora: new Date('2026-11-10T18:00:00.000Z'),
  })),
].join('\n')

describe('Fase 4 · la pantalla del CRM', () => {
  it('en español: el embudo, la lista, la ficha con su cotejo y su línea de tiempo', () => {
    const html = pantallas('es')
    // «Nueva oportunidad» ya no está aquí: desde el 18/11 el botón vive en el
    // encabezado de Propuestas, en el sitio de «Nueva propuesta».
    for (const f of ['Embudo', 'Oportunidades', 'Prospectos', 'Propuestas', 'Cotizando', 'Contacto',
      'Ves solo tus oportunidades.', 'Oportunidades abiertas', 'Presupuesto en juego', 'Resumen', 'Sin presupuesto', 'Lo que quiere el cliente', 'Días en cada etapa',
      'Lo que pide contra lo que se le cotizó', 'Pasó a Negociando', 'Cambió el descuento', 'Creó la propuesta',
      'Pidió precios', 'Siguiente: Mandar propuesta']) {
      expect(html, f).toContain(f)
    }
    // Con y sin IVA, con la tasa del cliente: 226 800 c/IVA contra un máximo
    // de 200 000 son 26 800 arriba (13.4 %); sin IVA, 210 000, 10 000 arriba (5 %).
    expect(html).toContain('$226,800.00 c/IVA 8 %')
    expect(html).toContain('$210,000.00 s/IVA')
    expect(html).toContain('c/IVA: Arriba por $26,800.00 (13.4 %)')
    expect(html).toContain('s/IVA: Arriba por $10,000.00 (5 %)')
    expect(html).toContain('Las que pidió')
    // Días por etapa: Contacto del 1 al 4, Negociando del 4 al 10.
    expect(html).toMatch(/Contacto · <span class="demo-num">3<\/span>/)
    expect(html).toMatch(/Negociando · <span class="demo-num">6<\/span>/)
  })

  const ESPANOL_F4 = [
    ES_CRM['crm.pestana.embudo'], ES_CRM['crm.etapa.cotizando'], ES_CRM['crm.nueva'], ES_CRM['crm.solo-tuyas'],
    ES_CRM['crm.kpi.abiertas'], ES_CRM['crm.kpi.en-juego'],
    ES_CRM['crm.sin-presupuesto'], ES_CRM['crm.ficha.quiere'], ES_CRM['crm.ficha.dias-etapa'], ES_CRM['crm.ficha.cotejo'],
    'Pasó a', 'Cambió el descuento', ES_CRM['crm.accion.crear'], ES_CRM['crm.ficha.fechas.igual'], 'Arriba por', ES_CRM['crm.cotejo.sin-iva'] + ':',
    ES_CRM['crm.ficha.linea'], ES_CRM['crm.ficha.actividad'],
  ]

  for (const idioma of ['en', 'it', 'pt'] as Idioma[]) {
    it(`en ${idioma} no queda ninguna frase española de la pantalla`, () => {
      const html = pantallas(idioma)
      expect(ESPANOL_F4.filter((f) => html.includes(f))).toEqual([])
      expect(html).toContain('Refrescos del Norte')
    })
  }
})

// ─── 18/11 · «no se debe de llamar CRM sino Propuestas» ─────────────────────
// Pedido del dueño. Se mira lo que se PINTA, en los cuatro idiomas, y además
// cada texto del ámbito: una clave nueva que dijera «CRM» la caza aquí aunque
// todavía no la use ninguna pantalla.
describe('18/11 · ninguna pantalla de Propuestas dice «CRM»', () => {
  for (const idioma of ['es', 'en', 'it', 'pt'] as Idioma[]) {
    it(`en ${idioma}`, () => {
      expect(pantallas(idioma)).not.toMatch(/\bCRM\b/)
      expect(Object.entries(DICCIONARIOS[idioma]).filter(([k, v]) => k.startsWith('crm.') && /\bCRM\b/.test(v))).toEqual([])
    })
  }

  it('la primera pestaña es la lista de propuestas, y las otras van a /propuestas?vista=', () => {
    const html = envolver('es', createElement(PestanasCrm, { activa: 'propuestas' }))
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
    expect(hrefs).toEqual(['/propuestas', '/propuestas?vista=embudo', '/propuestas?vista=oportunidades', '/propuestas?vista=prospectos'])
    expect(html).toMatch(/aria-current="page"[^>]*>Propuestas</)
  })
})

