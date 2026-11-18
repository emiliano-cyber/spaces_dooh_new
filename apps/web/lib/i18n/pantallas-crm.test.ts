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

const redirect = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  usePathname: () => '/propuestas',
  useSearchParams: () => new URLSearchParams(),
  redirect,
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
import { Seguimiento } from '@/components/demo/crm/Seguimiento'
import CrmPage from '@/app/(app)/(shell)/crm/page'
import { FichaOportunidad } from '@/components/demo/crm/FichaOportunidad'
import { PestanasCrm, pestanaDeVista, pestanaDeParametros, type PestanaCrm } from '@/components/demo/crm/PestanasCrm'
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
  oportunidades: [
    op({ id: 'o1', etapa: 'COTIZANDO', cotizaciones: 2 }),
    op({ id: 'o2', etapa: 'CONTACTO', presupuestoMin: null, presupuestoMax: null, clienteNombre: null, clienteId: null, prospectoNombre: 'Café Sur' }),
    op({ id: 'o3', etapa: 'PERDIDA', clienteNombre: 'Perdedora SA', perdidaEn: '2026-11-03T18:00:00.000Z', motivoPerdida: 'Precio' }),
  ],
  total: 3,
  porEtapa: { COTIZANDO: 1, CONTACTO: 1, PERDIDA: 1 },
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

const AHORA = new Date('2026-11-10T18:00:00.000Z')

const envolver = (idioma: Idioma, hijo: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(ProveedorIdioma, { idioma, puedeElegir: true }, hijo))

const pantallas = (idioma: Idioma) => [
  envolver(idioma, createElement(PestanasCrm, { activa: 'seguimiento' })),
  envolver(idioma, createElement(Seguimiento, { inicial: PAGINA, ahora: AHORA })),
  envolver(idioma, createElement(FichaOportunidad, {
    id: 'o1', inicial: FICHA, propuestasInicial: [PROP_LIGADA], ahora: new Date('2026-11-10T18:00:00.000Z'),
  })),
].join('\n')

describe('Fase 4 · la pantalla del CRM', () => {
  it('en español: Seguimiento, la ficha con su cotejo y su línea de tiempo', () => {
    const html = pantallas('es')
    // «Nueva oportunidad» ya no está aquí: desde el 18/11 el botón vive en el
    // encabezado de Propuestas, en el sitio de «Nueva propuesta».
    for (const f of ['Seguimiento', 'Prospectos', 'Propuestas', 'Cotizando', 'Contacto',
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
    ES_CRM['crm.pestana.seguimiento'], ES_CRM['crm.seguimiento.buscar'], ES_CRM['crm.seguimiento.perdidas'], 'negociando', ES_CRM['crm.etapa.cotizando'], ES_CRM['crm.nueva'], ES_CRM['crm.solo-tuyas'],
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

  // 18/11 (3.er pedido) · «el resumen de propuestas hazlo su propia sección y
  // que sea la primera en abrirse»: Resumen es `/propuestas` a secas y la
  // lista pasa a `?vista=propuestas`.
  it('la primera pestaña es el Resumen (/propuestas a secas); la lista y las otras van por ?vista=', () => {
    const html = envolver('es', createElement(PestanasCrm, { activa: 'propuestas' }))
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
    expect(hrefs).toEqual([
      '/propuestas',
      '/propuestas?vista=propuestas',
      '/propuestas?vista=seguimiento',
      '/propuestas?vista=prospectos',
    ])
    expect(html).toMatch(/aria-current="page"[^>]*>Propuestas</)
  })
})

// ─── 18/11 (2.º pedido) · «Embudo» → «Seguimiento», sin «Oportunidades» ─────
// El dueño quitó la pestaña Oportunidades («es casi igual al embudo») y
// renombró el embudo. Se vigila en los cuatro idiomas lo que se PINTA.
describe('18/11 · Seguimiento sustituye al embudo y a la lista de oportunidades', () => {
  const pestanas = (idioma: Idioma, activa: PestanaCrm = 'propuestas') =>
    envolver(idioma, createElement(PestanasCrm, { activa }))
  const rotulos = (html: string) => [...html.matchAll(/<a [^>]*>([^<]+)<\/a>/g)].map((m) => m[1])
  const seguimiento = (idioma: Idioma, pagina: PaginaOportunidades = PAGINA) =>
    envolver(idioma, createElement(Seguimiento, { inicial: pagina, ahora: AHORA }))

  it('cuatro pestañas: Resumen · Propuestas · Seguimiento · Prospectos (Resumen la primera)', () => {
    expect(rotulos(pestanas('es'))).toEqual(['Resumen', 'Propuestas', 'Seguimiento', 'Prospectos'])
    expect(rotulos(pestanas('en'))).toEqual(['Summary', 'Proposals', 'Follow-up', 'Prospects'])
    expect(rotulos(pestanas('it'))).toEqual(['Riepilogo', 'Proposte', 'Monitoraggio', 'Prospect'])
    expect(rotulos(pestanas('pt'))).toEqual(['Resumo', 'Propostas', 'Acompanhamento', 'Prospects'])
  })

  it('con el Resumen activo, el subrayado va en la primera', () => {
    for (const idioma of ['es', 'en', 'it', 'pt'] as Idioma[]) {
      const html = pestanas(idioma, 'resumen')
      expect(html).toMatch(new RegExp(`aria-current="page"[^>]*>${DICCIONARIOS[idioma]['crm.pestana.resumen']}<`))
      expect([...html.matchAll(/aria-current="page"/g)]).toHaveLength(1)
    }
  })

  for (const idioma of ['es', 'en', 'it', 'pt'] as Idioma[]) {
    it(`en ${idioma} nada dice «Embudo»/«Pipeline» y no hay pestaña Oportunidades`, () => {
      const html = pestanas(idioma, 'seguimiento') + seguimiento(idioma)
      expect(html).not.toMatch(/Embudo|Pipeline|Funil/)
      expect(html).not.toMatch(/vista=oportunidades|vista=embudo/)
      expect(rotulos(pestanas(idioma))).not.toContain(DICCIONARIOS[idioma]['nav.crm'])
      expect(rotulos(pestanas(idioma))).toHaveLength(4)
      expect(html).toMatch(new RegExp(`aria-current="page"[^>]*>${DICCIONARIOS[idioma]['crm.pestana.seguimiento']}<`))
    })
  }

  it('los marcadores viejos (?vista=embudo y ?vista=oportunidades) caen en Seguimiento', () => {
    expect(pestanaDeVista('seguimiento')).toBe('seguimiento')
    expect(pestanaDeVista('embudo')).toBe('seguimiento')
    expect(pestanaDeVista('oportunidades')).toBe('seguimiento')
    expect(pestanaDeVista('prospectos')).toBe('prospectos')
    expect(pestanaDeVista('propuestas')).toBe('propuestas')
    expect(pestanaDeVista('resumen')).toBe('resumen')
    expect(pestanaDeVista(null)).toBe('resumen')
    expect(pestanaDeVista(undefined)).toBe('resumen')
    expect(pestanaDeVista('cualquiera')).toBe('resumen')
  })

  it('sin ?vista= se abre el Resumen, salvo que la dirección pida un diálogo de la lista', () => {
    const de = (q: string) => pestanaDeParametros(new URLSearchParams(q))
    expect(de('')).toBe('resumen')
    expect(de('vista=propuestas')).toBe('propuestas')
    expect(de('vista=seguimiento')).toBe('seguimiento')
    // Marcadores de antes del 18/11: «Duplicar» y «Agregar sitios» abrían el
    // formulario desde `/propuestas?duplicar=…` sin vista; caen en la lista.
    expect(de('duplicar=p1')).toBe('propuestas')
    expect(de('agregar=p1')).toBe('propuestas')
    // Una vista explícita manda sobre el diálogo.
    expect(de('vista=prospectos&duplicar=p1')).toBe('prospectos')
    expect(pestanaDeParametros(null)).toBe('resumen')
  })

  it('/crm redirige: sin vista, ?vista=embudo y ?vista=oportunidades a Seguimiento; ?vista=prospectos a Prospectos', () => {
    const casos: [string | undefined, string][] = [
      [undefined, '/propuestas?vista=seguimiento'],
      ['embudo', '/propuestas?vista=seguimiento'],
      ['oportunidades', '/propuestas?vista=seguimiento'],
      ['seguimiento', '/propuestas?vista=seguimiento'],
      ['prospectos', '/propuestas?vista=prospectos'],
    ]
    for (const [vista, destino] of casos) {
      redirect.mockClear()
      CrmPage({ searchParams: { vista } })
      expect(redirect, String(vista)).toHaveBeenCalledWith(destino)
    }
  })

  it('una columna por etapa, con su cuenta y su monto; Perdida plegada por omisión', () => {
    const html = seguimiento('es')
    const columnas = [...html.matchAll(/<section aria-label="([^"]+)"/g)].map((m) => m[1])
    expect(columnas).toEqual(['Contacto', 'Necesidad', 'Cotizando', 'Negociando', 'Ganada'])
    // La perdida no se pinta, pero su chip dice cuántas hay.
    expect(html).not.toContain('Perdedora SA')
    expect(html).toMatch(/aria-pressed="false"[^>]*>Ver perdidas <span class="demo-num">1<\/span>/)
    // Cotizando: el monto de la columna es el máximo del rango.
    expect(html).toContain('Presupuesto: $200,000.00')
  })

  it('cada tarjeta: cliente, oportunidad, rango, cotizaciones, días y vendedor, y abre la ficha', () => {
    const html = seguimiento('es')
    expect(html).toContain('href="/crm/oportunidades/o1')
    expect(html).toContain('Refrescos del Norte')
    expect(html).toContain('Oportunidad o1')
    expect(html).toContain('$100,000.00 – $200,000.00')
    expect(html).toContain('2 cotizaciones')
    // Alta el 1/11, «hoy» el 10/11: 9 días.
    expect(html).toContain('9 días negociando')
    expect(html).toContain('Ana')
    // El prospecto sin cliente se ve por su nombre, y sin presupuesto lo dice.
    expect(html).toContain('Café Sur')
    expect(html).toContain('Sin presupuesto')
    // Las tarjetas ya no traen el selector de etapa del embudo: eso vive en la ficha.
    expect(html).not.toContain('<select')
  })

  it('el filtro de vendedor sale solo si quien mira ve a todo el equipo', () => {
    const solo = seguimiento('es')
    expect(solo).not.toContain('Todos los vendedores')
    expect(solo).toContain('Ves solo tus oportunidades.')
    const todos = seguimiento('es', { ...PAGINA, veTodas: true })
    expect(todos).toContain('Todos los vendedores')
    expect(todos).toContain('aria-label="Buscar cliente u oportunidad"')
  })

  it('las columnas se desplazan dentro de su contenedor, no la página', () => {
    const html = seguimiento('es')
    expect(html).toMatch(/class="min-w-0 overflow-x-auto[^"]*"><div class="flex items-start gap-3 xl:grid/)
    expect(html).toMatch(/<section aria-label="Contacto" class="w-64 shrink-0/)
  })
})


// ─── 18/11 (3.er pedido) · los prospectos también se ven en Seguimiento ─────
// El dueño: «los prospectos se deben de ver también en Seguimiento; creé uno y
// no se vio». Crear un prospecto no crea oportunidad, y Seguimiento solo
// pintaba oportunidades. Ahora el prospecto de tipo cliente SIN oportunidad
// sale como tarjeta en Contacto, con su acción «Crear oportunidad».
import type { Prospecto } from '@/lib/data/captacion-api'

const pro = (o: Partial<Prospecto> & Pick<Prospecto, 'id' | 'nombre'>): Prospecto =>
  ({
    tipo: 'CLIENTE',
    contacto: { nombre: 'Laura Pérez', telefono: null, email: null },
    direccion: null,
    lat: null,
    lng: null,
    datos: { razonSocial: 'Tacos Norte SA de CV' },
    etapa: 'PROSPECTO',
    siguientePaso: null,
    siguientePasoFecha: null,
    usuarioId: 'u2',
    vendedorNombre: 'Beto',
    decididoPorNombre: null,
    decididoEn: null,
    motivoRechazo: null,
    registroId: null,
    creadoEn: '2026-11-06T18:00:00.000Z',
    actualizadoEn: '2026-11-06T18:00:00.000Z',
    ...o,
  }) as Prospecto

describe('18/11 · los prospectos sin oportunidad se ven en Seguimiento', () => {
  // `o2` (Contacto) cuelga del prospecto `pr-cafe`: ese NO puede salir dos veces.
  const PAG: PaginaOportunidades = {
    ...PAGINA,
    oportunidades: PAGINA.oportunidades.map((o) => (o.id === 'o2' ? { ...o, prospectoId: 'pr-cafe' } : o)),
    veTodas: true,
  }
  const PROSPECTOS = [
    pro({ id: 'pr-tacos', nombre: 'Tacos El Güero' }),
    pro({ id: 'pr-cafe', nombre: 'Café Sur' }),
    // Uno aprobado (ya es cliente) y sin oportunidad: también se ve.
    pro({ id: 'pr-apro', nombre: 'Llantas Rápidas', etapa: 'APROBADO', registroId: 'c9', usuarioId: 'u1', vendedorNombre: 'Ana' }),
  ]
  const html = (idioma: Idioma = 'es', puedeCrear = true) =>
    envolver(idioma, createElement(Seguimiento, { inicial: PAG, prospectosInicial: PROSPECTOS, ahora: AHORA, puedeCrear }))
  // La primera columna es Contacto, en cualquier idioma.
  const contacto = (h: string) => h.match(/<section aria-label="[^"]+"[\s\S]*?<\/section>/)?.[0] ?? ''

  it('el prospecto sin oportunidad sale en la columna Contacto, con su etiqueta, contacto, vendedor y días', () => {
    const col = contacto(html())
    expect(col).toContain('Tacos El Güero')
    expect(col).toContain('>Prospecto<')
    expect(col).toContain('Laura Pérez')
    expect(col).toContain('Tacos Norte SA de CV')
    expect(col).toContain('Beto')
    // Registrado el 6/11, «hoy» el 10/11: 4 días.
    expect(col).toContain('Registrado hace 4 días')
    // El aprobado sin oportunidad también.
    expect(col).toContain('Llantas Rápidas')
    // Abre el prospecto en la pestaña Prospectos.
    expect(col).toContain('href="/propuestas?vista=prospectos&amp;prospecto=pr-tacos"')
  })

  it('el que ya tiene oportunidad NO sale duplicado como prospecto suelto', () => {
    const h = html()
    // Una sola tarjeta con ese nombre (el `title` repite el texto: se cuenta el texto).
    expect(h.match(/>Café Sur</g)?.length).toBe(1)
    expect(h).not.toContain('prospecto=pr-cafe')
  })

  it('cuenta en el número de la columna, y el vendedor del prospecto entra al filtro', () => {
    const col = contacto(html())
    // Una oportunidad (o2) más dos prospectos sueltos.
    expect(col).toMatch(/<span class="demo-num text-\[12px\] font-medium text-ink">3<\/span>/)
    expect(html()).toContain('<option value="u2">Beto</option>')
  })

  it('«Crear oportunidad» solo con comercial.crear', () => {
    expect(html('es', true)).toContain('Crear oportunidad')
    expect(html('es', false)).not.toContain('Crear oportunidad')
  })

  it('con solo prospectos y ninguna oportunidad, el tablero se pinta igual', () => {
    const vacio: PaginaOportunidades = { ...PAG, oportunidades: [], total: 0, porEtapa: {} }
    const h = envolver('es', createElement(Seguimiento, { inicial: vacio, prospectosInicial: PROSPECTOS, ahora: AHORA }))
    expect(h).not.toContain(ES_CRM['crm.vacio'])
    expect(contacto(h)).toContain('Tacos El Güero')
  })

  for (const idioma of ['en', 'it', 'pt'] as Idioma[]) {
    it(`en ${idioma} la tarjeta del prospecto no dice nada en español`, () => {
      const col = contacto(html(idioma))
      expect(col).toContain('Tacos El Güero')
      expect(col).not.toContain('>Prospecto<')
      expect(col).not.toContain('Crear oportunidad')
      expect(col).not.toContain('Registrado hace')
    })
  }
})

// La búsqueda filtra en el navegador: se prueba la función que la decide.
import { prospectoCoincide } from '@/components/demo/crm/Seguimiento'

describe('18/11 · la búsqueda de Seguimiento encuentra prospectos', () => {
  const p = pro({ id: 'pr-tacos', nombre: 'Tacos El Güero' })
  it('por nombre, contacto o razón social, sin acentos', () => {
    expect(prospectoCoincide(p, 'guero', '')).toBe(true)
    expect(prospectoCoincide(p, 'laura perez', '')).toBe(true)
    expect(prospectoCoincide(p, 'tacos norte', '')).toBe(true)
    expect(prospectoCoincide(p, 'pizza', '')).toBe(false)
  })
  it('y respeta el filtro de vendedor', () => {
    expect(prospectoCoincide(p, '', 'u2')).toBe(true)
    expect(prospectoCoincide(p, '', 'u1')).toBe(false)
  })
})

// ─── 18/11 (5.º pedido) · con todas sus oportunidades cerradas, vuelve ──────
// El dueño: «sí, que vuelva a aparecer como prospecto». La tarjeta suelta se
// oculta solo si el prospecto tiene una oportunidad ABIERTA; con todas
// cerradas (GANADA o PERDIDA) vuelve a Contacto, con su etapa y «Crear
// oportunidad» — la misma regla con la que el servidor deja abrir otra.
describe('18/11 · el prospecto con todas sus oportunidades cerradas vuelve a Seguimiento', () => {
  const PAG: PaginaOportunidades = {
    ...PAGINA,
    oportunidades: [
      op({ id: 'a1', etapa: 'NEGOCIANDO', prospectoId: 'pr-abierta', clienteNombre: null, prospectoNombre: 'Abierta SA' }),
      op({ id: 'c1', etapa: 'PERDIDA', prospectoId: 'pr-cerrada', perdidaEn: '2026-11-03T18:00:00.000Z', motivoPerdida: 'Precio' }),
      op({ id: 'c2', etapa: 'GANADA', prospectoId: 'pr-cerrada', ganadaEn: '2026-11-04T18:00:00.000Z' }),
      // Una cerrada y otra abierta del mismo: manda la abierta.
      op({ id: 'm1', etapa: 'PERDIDA', prospectoId: 'pr-mixta', perdidaEn: '2026-11-03T18:00:00.000Z', motivoPerdida: 'Precio' }),
      op({ id: 'm2', etapa: 'CONTACTO', prospectoId: 'pr-mixta' }),
      // Aprobado (ya es cliente) con su oportunidad GANADA: también vuelve.
      op({ id: 'g1', etapa: 'GANADA', prospectoId: 'pr-apro', ganadaEn: '2026-11-04T18:00:00.000Z' }),
    ],
    veTodas: true,
  }
  const PROSPECTOS = [
    pro({ id: 'pr-abierta', nombre: 'Con abierta' }),
    pro({ id: 'pr-cerrada', nombre: 'Con cerradas', etapa: 'VISITA' }),
    pro({ id: 'pr-mixta', nombre: 'Con mixta' }),
    pro({ id: 'pr-nada', nombre: 'Sin ninguna' }),
    pro({ id: 'pr-apro', nombre: 'Aprobado ganado', etapa: 'APROBADO', registroId: 'c9' }),
  ]
  const h = () =>
    envolver('es', createElement(Seguimiento, { inicial: PAG, prospectosInicial: PROSPECTOS, ahora: AHORA, puedeCrear: true }))

  it('con todas cerradas: sale como prospecto, con su etapa y «Crear oportunidad»', () => {
    const html = h()
    expect(html).toContain('prospecto=pr-cerrada')
    const i = html.indexOf('prospecto=pr-cerrada')
    const tarjeta = html.slice(html.lastIndexOf('<li', i), html.indexOf('</li>', i) + 5)
    expect(tarjeta).toContain('>Visita<')
    expect(html.slice(html.indexOf('</a>', i), html.indexOf('</li>', i))).toContain('Crear oportunidad')
  })
  it('con una abierta (aunque tenga cerradas): no', () => {
    expect(h()).not.toContain('prospecto=pr-abierta')
    expect(h()).not.toContain('prospecto=pr-mixta')
  })
  it('sin ninguna: sí, como siempre', () => {
    expect(h()).toContain('prospecto=pr-nada')
  })
  it('el aprobado con su oportunidad ganada también vuelve (el dueño: sí en general)', () => {
    expect(h()).toContain('prospecto=pr-apro')
  })
})
