import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { huellasDeFormatoEspanol } from './guardias-ingles'
import { huellasEnItaliano } from './guardias-italiano'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ProveedorIdioma } from './contexto'
import type { Idioma } from './idiomas'

// ============================================================================
//  I18N · LOTE «CATALOGOS DE PRECIO», RENDIDO EN LOS DOS IDIOMAS.
// ----------------------------------------------------------------------------
//  Paquetes cerrados, franjas y temporadas (con el horario de transmision y el
//  cuadro de tarifas por franja de la ficha de pantalla) y descuentos por
//  volumen. El mismo patron que `pantallas-campanas-finanzas.test.ts`: el
//  componente REAL dentro del proveedor, `renderToStaticMarkup`, y
//
//    (a) en ESPANOL sale el texto de siempre, letra por letra;
//    (b) en INGLES no queda NINGUNA frase espanola del lote.
//
//  Sin DOM no corren los `useEffect` que piden el catalogo, asi que se FUERZA
//  el valor inicial de `useState` (la lista cargada, «ya no esta cargando», el
//  error a la vista). Cada entrada de la cola es un predicado sobre el valor
//  INICIAL y se consume en orden: los `useState` del componente corren antes
//  que los de sus hijos, asi que el orden es el del cuerpo del componente.
//
//  Con `I18N_VOLCAR=<carpeta>` vuelca el HTML espanol de cada estado: se corre
//  antes y despues de tocar los componentes y se compara con `diff -rq`.
//
//  LO QUE NO VE: los avisos de franja que manda el servidor (`a.texto` de la
//  programacion) y los mensajes del servidor (I18N-05).
// ============================================================================

type Forzado = { si: (inicial: unknown) => boolean; valor: unknown }
const forzado = vi.hoisted(() => ({ cola: [] as Forzado[] }))
const datos = vi.hoisted(() => ({ sitios: [] as unknown[] }))

vi.mock('react', async (importOriginal) => {
  const real = await importOriginal<typeof import('react')>()
  function useState(inicial?: unknown) {
    const cabeza = forzado.cola[0]
    const valorInicial = typeof inicial === 'function' ? undefined : inicial
    if (cabeza && cabeza.si(valorInicial)) {
      forzado.cola.shift()
      return real.useState(cabeza.valor)
    }
    return real.useState(inicial)
  }
  return { ...real, default: { ...real, useState }, useState }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/franjas-y-temporadas',
}))

vi.mock('@/lib/data/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/data/client')>()
  return { ...real, useSitios: () => datos.sitios }
})

vi.mock('@/components/demo/ui/Modal', () => ({
  Modal: (p: { open: boolean; title: string; subtitle?: string; children: unknown; footer?: unknown }) =>
    p.open
      ? createElement('div', null, createElement('h2', null, p.title),
          p.subtitle ? createElement('p', null, p.subtitle) : null, p.children as never, p.footer as never)
      : null,
}))
vi.mock('@/components/demo/ui/CardColapsable', () => ({
  CardColapsable: (p: { titulo: string; subtitulo?: unknown; resumen?: unknown; children?: unknown }) =>
    createElement('section', null, createElement('h3', null, p.titulo), createElement('p', null, p.subtitulo as never),
      p.resumen as never, p.children as never),
}))

beforeEach(() => {
  process.env.IDIOMA_INGLES = '1'
  forzado.cola = []
  datos.sitios = []
})

function pintar(idioma: Idioma, el: ReactElement): string {
  return renderToStaticMarkup(createElement(ProveedorIdioma, { idioma, puedeElegir: true }, el))
}

function texto(html: string): string {
  return html
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

const forzar = (si: (v: unknown) => boolean, valor: unknown) => forzado.cola.push({ si, valor })
const esVacio = (v: unknown) => Array.isArray(v) && v.length === 0
const esNull = (v: unknown) => v === null
const esTrue = (v: unknown) => v === true
const esFalse = (v: unknown) => v === false
const esObjetoCon = (campo: string) => (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v) && campo in (v as object)
const esObjetoVacio = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0

// ─── Datos de prueba ────────────────────────────────────────────────────────
const SITIOS = [
  { id: 's1', nombre: 'Pantalla Reforma', tarifaMensual: 60000 },
  { id: 's2', nombre: 'Pantalla Sur', tarifaMensual: 40000 },
  { id: 's3', nombre: 'Pantalla Norte', tarifaMensual: 0 },
]
const PAQUETES = [
  { id: 'p1', nombre: 'Paquete Centro', precioCerrado: 90000, admiteCodigo: true, activo: true, sitios: ['s1', 's2'], aplicadoEn: 3 },
  { id: 'p2', nombre: 'Paquete Viejo', precioCerrado: 30000, admiteCodigo: false, activo: false, sitios: ['s3'], aplicadoEn: 0 },
]
const FRANJAS = [
  { id: 'f1', nombre: 'Prime', horaInicio: '18:00', horaFin: '22:00', orden: 1, activo: true },
  { id: 'f2', nombre: 'Madrugada', horaInicio: '00:00', horaFin: '06:00', orden: 2, activo: false },
]
const TEMPORADAS = [
  { id: 't1', nombre: 'Buen Fin 2026', desde: '2026-11-13', hasta: '2026-11-16', activo: true },
  { id: 't2', nombre: 'Navidad 2025', desde: '2025-12-01', hasta: '2025-12-31', activo: false },
]
const TRAMOS = [
  { id: 'v1', unidad: 'spot', desdeCantidad: 50, descuentoPct: 10 },
  { id: 'v2', unidad: 'spot', desdeCantidad: 100, descuentoPct: 15 },
  { id: 'v3', unidad: 'mensual', desdeCantidad: 3, descuentoPct: 5 },
  { id: 'v4', unidad: 'trimestral', desdeCantidad: 2, descuentoPct: 8 },
]
const PROG_FRANJAS = [
  { id: 'f1', nombre: 'Prime', horaInicio: '18:00', horaFin: '22:00', activo: true },
  { id: 'f3', nombre: 'Mañana', horaInicio: '06:00', horaFin: '10:00', activo: true },
  { id: 'f4', nombre: 'Tarde', horaInicio: '14:00', horaFin: '18:00', activo: true },
]
const PROG_CAMPANAS = [
  { id: 'c1', folio: 'CA-0001', nombre: 'Verano', franjaProgramadaId: 'f1', estadoComercial: 'ACTIVA',
    avisos: [{ franjaContratadaId: 'f3', texto: 'aviso-del-servidor' }] },
  { id: 'c2', folio: null, nombre: 'Otoño', franjaProgramadaId: 'f3', estadoComercial: 'ACTIVA', avisos: [] },
  { id: 'c3', folio: 'CA-0003', nombre: 'Invierno', franjaProgramadaId: null, estadoComercial: 'ACTIVA', avisos: [] },
]
const SITIO_DLG = { id: 's1', nombre: 'Pantalla Reforma', exhibicion: 'digital' }
const FILAS_DLG = [
  { unidad: 'spot', franjaId: 'f1', temporadaId: null, tarifaPublicada: 120 },
  { unidad: 'mensual', franjaId: null, temporadaId: 't1', tarifaPublicada: 80000 },
  { unidad: 'diaria', franjaId: 'f9', temporadaId: 't9', tarifaPublicada: 5000 },
]

type Pantalla = {
  nombre: string
  pintar: (idioma: Idioma) => Promise<string>
  espanol: string[]
  ingles: string[]
  /** Texto italiano que tiene que salir en `it` (lote L2, 2026-11-03). */
  italiano?: string[]
}

const PANTALLAS: Pantalla[] = [
  // ── Paquetes ──
  {
    nombre: 'paquetes · cargando',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/paquetes/page')
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Paquetes cerrados',
      'Un conjunto de pantallas con un precio del conjunto. Sustituye la suma de sus tarifas de lista; no la descuenta.',
      'aria-label="Cargando los paquetes"',
    ],
    ingles: [
      'Bundles',
      'A set of screens with a price for the whole set. It replaces the sum of their list rates; it does not discount it.',
      'aria-label="Loading bundles"',
    ],
  },
  {
    nombre: 'paquetes · catalogo vacio',
    pintar: async (idioma) => {
      const { GestionPaquetes } = await import('../../components/demo/paquetes/GestionPaquetes')
      datos.sitios = SITIOS
      forzar(esVacio, []) // paquetes
      forzar(esNull, null) // error
      forzar(esTrue, false) // cargando
      return pintar(idioma, createElement(GestionPaquetes))
    },
    espanol: [
      'El precio del paquete SUSTITUYE la suma de las tarifas de lista: no la descuenta, la reemplaza.',
      'Da igual lo que sumen las pantallas — se cobra el precio del paquete.',
      'no admite descuento por volumen',
      '(su precio ya lo lleva dentro) ni código de negociación, salvo que marques la casilla de abajo. El descuento comercial de la propuesta sí se sigue aplicando encima.',
      'quitar una pantalla de una propuesta ya cotizada NO baja el precio',
      ': el reparto se recalcula entre las que quedan y la propuesta lo avisa.',
      'Paquetes de la organización',
      'Se reparte a prorrata de la tarifa de lista',
      'El precio se reparte entre las pantallas ',
      'a prorrata de su tarifa de lista',
      ', y la suma de las partes da el precio del paquete ',
      'con exactitud',
      '. Ese reparto es el ingreso que el reporte de rentabilidad le atribuye a cada pantalla.',
      'Precio cerrado',
      '¿Códigos?',
      'En uso',
      'Todavía no hay ninguno. Sin paquetes, todo se vende al precio de tarifa — que es exactamente como funciona hoy.',
      'Nuevo paquete',
      'aria-label="Nombre del paquete"',
      'placeholder="p. ej. Paquete Periférico"',
      'Precio del conjunto (cantidad entera, sin centavos)',
      'aria-label="Precio cerrado del paquete"',
      'placeholder="p. ej. 180,000"',
      'Admite código de negociación encima',
      'Pantallas del paquete',
      ' (obligatorio)',
      ' (mínimo 2). Una propuesta solo puede aplicar este paquete si tiene ',
      'exactamente',
      ' estas pantallas.',
      '>0</span> elegidas',
      '$ 60,000 de lista',
      'Crear paquete',
    ],
    ingles: [
      'The bundle price REPLACES the sum of the list rates: it does not discount it, it replaces it.',
      'Whatever the screens add up to, the bundle price is what gets billed.',
      'does not take a volume discount',
      'Bundles in your organization',
      '<b>exactly</b> these screens',
      'Create bundle',
      '>0</span> selected',
      'MX$ 60,000 at list',
      ' (required)',
    ],
  },
  {
    nombre: 'paquetes · con paquetes, error y reparto previsto por debajo de la lista',
    pintar: async (idioma) => {
      const { GestionPaquetes } = await import('../../components/demo/paquetes/GestionPaquetes')
      datos.sitios = SITIOS
      forzar(esVacio, PAQUETES)
      forzar(esNull, 'error-de-prueba')
      forzar(esTrue, false)
      forzar(esObjetoCon('precioCerrado'), { nombre: 'Centro', precioCerrado: '90000', admiteCodigo: false, sitios: ['s1', 's2'] })
      return pintar(idioma, createElement(GestionPaquetes))
    },
    espanol: [
      'Activo',
      'Desactivado',
      '2 pantallas',
      '1 pantalla',
      'Admite código',
      'Precio final',
      'title="Propuestas que aplican este paquete"',
      'En uso · 3',
      'Desactivar',
      'Activar',
      'title="Desactivar conserva la definición y deja de poder venderse. Lo ya cotizado y lo ya aprobado no se mueven."',
      'title="Eliminar: ninguna venta se mueve, porque su precio ya está copiado en cada propuesta. Lo que se pierde es saber de qué paquete salió."',
      'Eliminar',
      '>2</span> elegidas',
      '>Lista <span',
      '>Paquete <span',
      'se deja de cobrar ',
      'Así se repartiría entre las pantallas — y esto es lo que el reporte de rentabilidad le atribuirá a cada una:',
      'Parte del paquete',
      'Suma de las partes ',
      '— cuadra exacto',
    ],
    ingles: [
      'Active',
      'Deactivated',
      '>2 screens</div>',
      '>1 screen</div>',
      'Takes negotiation codes',
      'Negotiation codes',
      'MX$ 10,000</span> below list',
      'Final price',
      'In use · 3',
      'Deactivate',
      'Delete',
      '>2</span> selected',
      'Bundle share',
      'Sum of the shares',
    ],
  },
  {
    nombre: 'paquetes · una pantalla elegida y precio por encima de la lista',
    pintar: async (idioma) => {
      const { GestionPaquetes } = await import('../../components/demo/paquetes/GestionPaquetes')
      datos.sitios = SITIOS
      forzar(esVacio, [])
      forzar(esNull, null)
      forzar(esTrue, false)
      forzar(esObjetoCon('precioCerrado'), { nombre: '', precioCerrado: '70000', admiteCodigo: true, sitios: ['s1'] })
      return pintar(idioma, createElement(GestionPaquetes))
    },
    espanol: ['>1</span> elegida', 'se cobra ', ' POR ENCIMA de la lista'],
    ingles: ['>1</span> selected', '</span> ABOVE list'],
  },

  // ── Franjas y temporadas ──
  {
    nombre: 'franjas y temporadas · cargando',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/franjas-y-temporadas/page')
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Franjas y temporadas',
      'Las dos dimensiones de la tarifa: la hora del día y la época del año. Se capturan una vez y valen para todo el inventario.',
      'aria-label="Cargando el catálogo"',
      'aria-label="Cargando la programación"',
    ],
    ingles: ['Dayparts and seasons', 'aria-label="Loading the catalog"', 'aria-label="Loading the schedule"'],
  },
  {
    nombre: 'franjas y temporadas · catalogo vacio',
    pintar: async (idioma) => {
      const { GestionRejilla } = await import('../../components/demo/rejilla/GestionRejilla')
      forzar(esVacio, []) // franjas
      forzar(esVacio, []) // temporadas
      forzar(esNull, null) // error
      forzar(esTrue, false) // cargando
      return pintar(idioma, createElement(GestionRejilla))
    },
    espanol: [
      'Franjas horarias',
      'Fin exclusivo · sin solapes',
      'El fin es ',
      'exclusivo',
      ': 06:00–10:00 y 10:00–14:00 se tocan y no se pisan. Dos franjas no pueden solaparse — si pudieran, el precio de un spot a las 09:30 dependería de un desempate que nadie decidió.',
      'Nombre',
      'Desde',
      'Hasta',
      'Orden',
      'Estado',
      'Todavía no hay ninguna. Sin franjas, todo se vende con la tarifa base — que es exactamente como funciona hoy.',
      'aria-label="Nombre de la franja"',
      'placeholder="p. ej. Prime"',
      'aria-label="Hora de inicio"',
      'aria-label="Hora de fin"',
      'aria-label="Orden"',
      'Añadir',
      'Temporadas',
      'Fechas con año · ambos extremos entran',
      'Fechas ',
      'concretas',
      ', con año: «Buen Fin 2026» y «Buen Fin 2027» son dos temporadas, porque las fechas cambian cada año. Ambos extremos entran. Tampoco pueden solaparse: si «Diciembre» y «Buen Fin» se pisan, hay que decidir qué precio manda esos días.',
      'Todavía no hay ninguna.',
      'aria-label="Nombre de la temporada"',
      'placeholder="p. ej. Buen Fin 2026"',
      'aria-label="Fecha de inicio"',
      'aria-label="Fecha de fin"',
    ],
    ingles: [
      'Dayparts',
      'End is exclusive · no overlaps',
      'Seasons',
      'Dates with year · both ends included',
      'None yet.',
      'Add',
      'aria-label="Daypart name"',
      'placeholder="e.g. Buen Fin 2026"',
    ],
  },
  {
    nombre: 'franjas y temporadas · con datos y un error',
    pintar: async (idioma) => {
      const { GestionRejilla } = await import('../../components/demo/rejilla/GestionRejilla')
      forzar(esVacio, FRANJAS)
      forzar(esVacio, TEMPORADAS)
      forzar(esNull, 'error-de-prueba')
      forzar(esTrue, false)
      return pintar(idioma, createElement(GestionRejilla))
    },
    espanol: [
      'Activa',
      'Dada de baja',
      'title="Dar de baja: deja de ofrecerse, y lo ya contratado sigue en pie"',
      'Dar de baja',
      '13/11/2026',
    ],
    ingles: ['>Active<', '>Deactivated<', '</svg> Deactivate</button>', 'Nov 13, 2026'],
  },

  // ── Horario de transmision ──
  {
    nombre: 'horario de transmision · sin permiso y sin franjas activas',
    pintar: async (idioma) => {
      const { ProgramacionPorFranja } = await import('../../components/demo/rejilla/ProgramacionPorFranja')
      forzar(esVacio, [{ ...PROG_FRANJAS[0], activo: false }]) // franjas
      forzar(esVacio, []) // campanas
      forzar(esObjetoVacio, {}) // marcadas
      forzar(esNull, null) // error
      forzar(esFalse, false) // ocupado
      forzar(esTrue, false) // cargando
      return pintar(idioma, createElement(ProgramacionPorFranja))
    },
    espanol: [
      'Horario de transmisión',
      'No cambia ningún precio',
      'En qué franja ',
      'se transmite',
      ' cada campaña. No cambia ningún precio: lo vendido ya está en la campaña desde la propuesta. Puedes marcar varias campañas y programarlas de una vez; si alguna no se puede, no se programa ninguna.',
      'Solo el gerente de ventas, el director comercial y la dirección pueden programar el horario. Aquí ves cómo está.',
      'Da de alta al menos una franja arriba para poder programar campañas en ella.',
    ],
    ingles: ['Broadcast schedule', 'No price changes', 'Add at least one daypart above to schedule campaigns in it.'],
  },
  {
    nombre: 'horario de transmision · con campanas, marcadas y un error',
    pintar: async (idioma) => {
      const { ProgramacionPorFranja } = await import('../../components/demo/rejilla/ProgramacionPorFranja')
      forzar(esVacio, PROG_FRANJAS)
      forzar(esVacio, PROG_CAMPANAS)
      forzar(esObjetoVacio, { f1: ['c2'], f3: ['c1', 'c3'] })
      forzar(esNull, 'error-de-prueba')
      forzar(esFalse, false) // ocupado
      forzar(esTrue, false) // cargando
      forzar(esFalse, true) // puede
      return pintar(idioma, createElement(ProgramacionPorFranja))
    },
    espanol: [
      '1 campaña',
      '0 campañas',
      'Ninguna campaña se transmite en esta franja.',
      'aria-label="Quitar CA-0001 · Verano de Prime"',
      'title="Quitar de esta franja (no toca lo vendido)"',
      'CA-0001 · Verano: aviso-del-servidor',
      'Programar campañas en Prime (1 marcada)',
      'Programar campañas en Mañana (2 marcadas)',
      'Programar campañas en Tarde',
      '(hoy en Mañana)',
      'Programar 1 en Prime',
      'Programar 2 en Mañana',
      'Programar  en Tarde',
    ],
    ingles: [
      '>1 campaign</span>',
      '>0 campaigns</span>',
      'No campaign airs in this daypart.',
      'aria-label="Remove CA-0001 · Verano from Prime"',
      'Schedule campaigns in Prime (1 selected)</summary>',
      'Schedule campaigns in Mañana (2 selected)</summary>',
      'Schedule in Tarde</button>',
      '(now in Mañana)',
      'Schedule 1 in Prime',
    ],
  },

  // ── Tarifas por franja de UNA pantalla (ficha de pantalla) ──
  {
    nombre: 'tarifas por franja · sin catalogo',
    pintar: async (idioma) => {
      const { RejillaDialog } = await import('../../components/demo/rejilla/RejillaDialog')
      forzar(esTrue, false) // cargando
      return pintar(idioma, createElement(RejillaDialog, { sitio: SITIO_DLG, open: true, onClose: () => {} }))
    },
    espanol: [
      'Tarifas por franja y temporada',
      'Cancelar',
      'Guardar tarifas',
      'Esta organización todavía no tiene franjas ni temporadas. Se declaran una sola vez en ',
      'Franjas y temporadas',
      ', y valen para todo el inventario.',
      'Unidad',
      'Franja',
      'Temporada',
      'Tarifa',
    ],
    ingles: ['Rates by daypart and season', 'Cancel', 'Save rates', 'Dayparts and seasons', 'Rate'],
  },
  {
    nombre: 'tarifas por franja · con filas, una invalida y la fila nueva',
    pintar: async (idioma) => {
      const { RejillaDialog } = await import('../../components/demo/rejilla/RejillaDialog')
      forzar(esVacio, FRANJAS.filter((f) => f.activo)) // franjas
      forzar(esVacio, TEMPORADAS.filter((t) => t.activo)) // temporadas
      forzar(esVacio, FILAS_DLG) // filas
      forzar(esObjetoVacio, { 'spot|f1|': 'NaN', 'mensual||t1': '80000', 'diaria|f9|t9': '5000' }) // tarifas
      forzar(esVacio, ['diaria|f9|t9']) // quitadas
      forzar(esObjetoCon('tarifa'), { unidad: '', franjaId: '', temporadaId: '', tarifa: '' }) // nueva
      forzar(esTrue, false) // cargando
      return pintar(idioma, createElement(RejillaDialog, { sitio: SITIO_DLG, open: true, onClose: () => {} }))
    },
    espanol: [
      'Hay una tarifa en rojo que no se entiende: la coma separa miles y el punto, decimales (15,000.50).',
      'Solo hace falta capturar las combinaciones que tengan un precio distinto. Lo que no esté aquí se cobra con la tarifa por unidad de siempre — la rejilla no obliga a llenar nada.',
      'Prime · 18:00–22:00',
      'Todo el día',
      'Todo el año',
      'aria-label="Tarifa de spot"',
      'aria-label="Quitar"',
      'aria-label="Conservar"',
      'aria-label="Unidad de la nueva tarifa"',
      'Unidad…',
      'aria-label="Franja de la nueva tarifa"',
      'aria-label="Temporada de la nueva tarifa"',
      'aria-label="Tarifa de la nueva fila"',
      'title="Escribe solo cifras: la coma separa miles y el punto, decimales. Ejemplo: 212,500.50"',
      '>programatico</option>',
    ],
    ingles: [
      'A rate in red cannot be read: the comma separates thousands and the period, decimals (15,000.50).',
      'All day',
      'All year',
      'aria-label="Rate for CPS · cost per play"',
      'aria-label="Remove"',
      'aria-label="Keep"',
      'Unit…',
      'Monthly',
      'title="Enter digits only: the comma separates thousands and the period, decimals. Example: 212,500.50"',
      '>Programmatic</option>',
    ],
  },
  {
    nombre: 'tarifas por franja · cargando',
    pintar: async (idioma) => {
      const { RejillaDialog } = await import('../../components/demo/rejilla/RejillaDialog')
      forzar(esVacio, FRANJAS)
      return pintar(idioma, createElement(RejillaDialog, { sitio: SITIO_DLG, open: true, onClose: () => {} }))
    },
    espanol: ['Cargando…'],
    ingles: ['Loading…'],
  },

  // ── Descuentos por volumen ──
  {
    nombre: 'volumen · cargando',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/descuentos-por-volumen/page')
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Descuentos por volumen',
      'Qué descuento gana quien compra mucho. Se captura una vez por unidad de venta y vale para todo el inventario.',
      'aria-label="Cargando la escala"',
    ],
    ingles: ['Volume discounts', 'aria-label="Loading the scale"'],
  },
  {
    nombre: 'volumen · escala vacia',
    pintar: async (idioma) => {
      const { GestionVolumen } = await import('../../components/demo/volumen/GestionVolumen')
      forzar(esVacio, []) // tramos
      forzar(esNull, null) // error
      forzar(esTrue, false) // cargando
      return pintar(idioma, createElement(GestionVolumen))
    },
    espanol: [
      'El descuento se aplica sobre TODAS las unidades, no solo sobre las que pasan del umbral.',
      '«A partir de 50 spots, 10 %» quiere decir que quien compra 50 paga los 50 con el 10 % menos. Consecuencia: quien compra 49 paga más que quien compra 50, y el salto puede ser mayor que el precio de una unidad.',
      'Y se ',
      'compone',
      ' con el descuento comercial: un 20 % aquí y un 20 % en la propuesta dejan al cliente pagando el ',
      '64 %',
      ', no el 60 %.',
      'Tramos por unidad de venta',
      'Cada unidad tiene su propia escala',
      'title="El descuento del tramo alcanzado se aplica a TODAS las unidades"',
      'Escala plana (volumen)',
      'Cada unidad tiene su propia escala, porque 50 spots y 50 meses no son la misma compra. Los tramos tienen que ',
      'crecer',
      ': comprar más nunca puede descontar menos.',
      'A partir de',
      'Descuento',
      'Todavía no hay ninguno. Sin tramos, todo se vende al precio de tarifa — que es exactamente como funciona hoy.',
      'aria-label="Unidad de venta"',
      'CPS · costo por salida',
      'Mensual',
      'aria-label="A partir de qué cantidad"',
      'placeholder="p. ej. 50"',
      'aria-label="Descuento por ciento"',
      'placeholder="p. ej. 10"',
      'Añadir tramo',
    ],
    ingles: [
      'The discount applies to ALL units, not only to those above the threshold.',
      'Tiers by sales unit',
      'Flat scale (volume)',
      '64%',
      'CPS · cost per play',
      'Monthly',
      'Add tier',
      'placeholder="e.g. 50"',
    ],
  },
  {
    nombre: 'volumen · con tramos, una unidad desconocida y un error',
    pintar: async (idioma) => {
      const { GestionVolumen } = await import('../../components/demo/volumen/GestionVolumen')
      forzar(esVacio, TRAMOS)
      forzar(esNull, 'error-de-prueba')
      forzar(esTrue, false)
      return pintar(idioma, createElement(GestionVolumen))
    },
    espanol: [
      ' · 2 tramos',
      ' · 1 tramo',
      'Escalón 1',
      'Escalón 2',
      'desde 50 salidas',
      'desde 3 meses',
      '→ 10 %',
      'title="Eliminar: deja de aplicarse a partir de ahora. Lo ya cotizado y lo ya aprobado no se mueven."',
      'trimestral',
    ],
    ingles: [' · 2 tiers</span>', ' · 1 tier</span>', 'Step 1<', 'from 50 plays', 'from 3 months', '→ 10%'],
  },
]

describe('lote CATALOGOS · en ESPANOL sale el texto de siempre', () => {
  PANTALLAS.forEach((p, i) => {
    it(p.nombre, async () => {
      const crudo = await p.pintar('es')
      const dir = process.env.I18N_VOLCAR
      if (dir) {
        mkdirSync(dir, { recursive: true })
        writeFileSync(path.join(dir, `${String(i).padStart(2, '0')}-es.html`), crudo)
      }
      const html = texto(crudo)
      expect(p.espanol.filter((f) => !html.includes(f))).toEqual([])
    })
  })
})

// Fragmentos de la lista espanola que son IGUALES en ingles a proposito.
const COMUNES = new Set<string>([
  // Datos de prueba y horas.
  // El aviso de la programacion lo manda el servidor (I18N-05) y la unidad
  // desconocida es un dato: los dos salen tal cual en los dos idiomas.
  'Prime · 18:00–22:00', 'CA-0001 · Verano: aviso-del-servidor', 'trimestral',
])

describe('lote CATALOGOS · en INGLES no queda ninguna frase espanola del lote', () => {
  for (const p of PANTALLAS) {
    it(p.nombre, async () => {
      const html = texto(await p.pintar('en'))
      expect(p.espanol.filter((f) => html.includes(f) && !COMUNES.has(f))).toEqual([])
      expect(p.ingles.filter((f) => !html.includes(f))).toEqual([])
    })
  }
})

describe('lote CATALOGOS · barrido con el diccionario entero', () => {
  async function htmlIngles(): Promise<string> {
    let html = ''
    for (const p of PANTALLAS) {
      forzado.cola = []
      datos.sitios = []
      const crudo = await p.pintar('en')
      const visibles = [...crudo.matchAll(/(?:title|aria-label|placeholder|alt)="([^"]*)"/g)].map((m) => m[1])
      html += texto(crudo.replace(/<[^>]*>/g, '\n') + '\n' + visibles.join('\n'))
    }
    // Los nombres de los datos de prueba no son texto de la interfaz.
    for (const a of ['Pantalla Reforma', 'Pantalla Sur', 'Pantalla Norte', 'Paquete Centro', 'Paquete Viejo', 'Buen Fin 2026', 'Navidad 2025', 'Madrugada', 'Mañana', 'Tarde', 'Verano', 'Otoño', 'Invierno', 'aviso-del-servidor', 'error-de-prueba']) {
      html = html.split(a).join('\n')
    }
    return html
  }

  it('ninguna frase espanola del diccionario de catalogos aparece en las pantallas en ingles', async () => {
    const { ES_CATALOGOS, EN_CATALOGOS } = await import('./textos/catalogos')
    const html = await htmlIngles()
    const culpables: string[] = []
    for (const [clave, frase] of Object.entries(ES_CATALOGOS)) {
      for (const trozo of frase.split(/\{\w+\}/)) {
        const t = trozo.trim()
        if (t.length < 8 || EN_CATALOGOS[clave as keyof typeof EN_CATALOGOS].includes(t)) continue
        if (html.includes(t)) culpables.push(`${clave} · «${t}»`)
      }
    }
    expect(culpables).toEqual([])
  })

  it('ni de los modulos compartidos (unidades, aviso de la franja, candado, «obligatorio»)', async () => {
    const { ES_COMPARTIDOS, EN_COMPARTIDOS } = await import('./textos/compartidos')
    const html = await htmlIngles()
    const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const culpables: string[] = []
    for (const [clave, es] of Object.entries(ES_COMPARTIDOS)) {
      const en = EN_COMPARTIDOS[clave as keyof typeof EN_COMPARTIDOS]
      for (const trozo of es.split(/\{\w+\}/)) {
        const t = trozo.trim()
        if (t.length < 4 || en.includes(t)) continue
        if (new RegExp(`(^|[^\\p{L}])${escapar(t)}($|[^\\p{L}])`, 'u').test(html)) culpables.push(`${clave} · «${t}»`)
      }
    }
    expect(culpables).toEqual([])
  })
})

// Costura 2 (2026-11-02): un `formatFecha` o un `formatMonto` sin idioma no
// deja ninguna FRASE espanola, solo su formato (dd/mm/aaaa, «20 de octubre
// de 2026», «02-nov», «a. m.», «$ 1,000.00» sin MX$). El barrido de frases
// no lo ve; el ayudante comun (`lib/i18n/guardias-ingles.ts`) si, tambien en
// los `title`, `aria-label`, `placeholder` y `alt`.
describe('lote CATALOGOS · en ingles, ninguna fecha, hora ni importe con formato espanol', () => {
  for (const p of PANTALLAS) {
    it(p.nombre, async () => {
      expect(huellasDeFormatoEspanol(await p.pintar('en'))).toEqual([])
    })
  }
})

// ─── ITALIANO · lote L2 «Comercial y propuestas» (2026-11-03) ───────────────
//
// Las mismas pantallas, rendidas en ITALIANO, en tres sentidos (el mismo
// patron que `pantallas-comercial.test.ts`): (a) ninguna frase de las listas a
// mano queda en el HTML italiano, salvo las que el italiano dice igual o las
// de OTRO ambito; (b) barrido con el diccionario: ningun trozo espanol NI
// INGLES de `catalogos.*` aparece; (c) ninguna huella de formato espanol o
// ingles (`guardias-italiano.ts`).

// Frases de las listas que en italiano se dicen IGUAL a proposito.
const COMUNES_IT = new Set<string>([
  ...COMUNES,
  '64%', // igual en ingles y en italiano
  '→ 10%', // igual en ingles y en italiano
])

// Frases inglesas de las listas que en esta pantalla NO son de este lote.
const AJENAS_IT = new Set<string>([
  'Bundles', 'Dayparts and seasons', 'Volume discounts', // titulos: el menu (`nav.*`, base)
  ' (required)', // el « (obligatorio)» de `Campo`: compartidos
  'Cancel', 'Loading…', // comun (base)
  'Monthly', 'CPS · cost per play', '>Programmatic</option>', // unidades: compartidos
  'title="Enter digits only: the comma separates thousands and the period, decimals. Example: 212,500.50"', // `CampoCifra`: compartidos
])

// Los ejemplos de las cifras que se TECLEAN van en el formato del campo
// (`lib/captura-cifra.ts`: coma de miles, punto decimal), no en el italiano de
// la pantalla: el «180,000» del precio del paquete, el «15,000.50» de la tarifa
// ilegible y el «212,500.50» del aviso de `CampoCifra` (compartidos).
const PERMITIDOS_IT = [/^180,000$/, /^15,000\.50$/, /^212,500\.50$/]

function legible(crudo: string): string {
  const visibles = [...crudo.matchAll(/(?:title|aria-label|placeholder|alt)="([^"]*)"/g)].map((m) => m[1])
  return texto(crudo.replace(/<[^>]*>/g, '\n') + '\n' + visibles.join('\n'))
}

const ITALIANO: Record<string, string[]> = {
  'paquetes · con paquetes, error y reparto previsto por debajo de la lista': ['2 impianti', '1 impianto', 'MX$ 90.000', ' scelti', 'Listino <span class="demo-num text-ink">MX$ 100.000<', 'MX$ 10.000'],
  'paquetes · una pantalla elegida y precio por encima de la lista': [' scelto', 'MX$ 60.000 di listino', 'IN PIÙ rispetto al listino'],
  'horario de transmision · con campanas, marcadas y un error': ['1 campagna', '0 campagne', 'Programma campagne in Prime (1 selezionata)', ' (2 selezionate)', 'Programma 2 in Mañana'],
  'volumen · con tramos, una unidad desconocida y un error': [' · 1 scaglione', ' · 2 scaglioni', 'Gradino 2', '→ 15%'],
  'franjas y temporadas · con datos y un error': ['13 nov 2026', 'Disattivata', 'Fine esclusa · senza sovrapposizioni'],
}
for (const p of PANTALLAS) p.italiano = ITALIANO[p.nombre]

describe('lote CATALOGOS · en ITALIANO', () => {
  // El italiano que TIENE que salir en algunas pantallas (`ITALIANO`, arriba):
  // concordancias de genero y numero con el hueco, plurales y formatos. Una
  // pantalla que no este alli solo se mira con el barrido y la guardia.
  it('las frases italianas declaradas son de pantallas que existen', () => {
    const nombres = new Set(PANTALLAS.map((p) => p.nombre))
    expect(Object.keys(ITALIANO).filter((n) => !nombres.has(n))).toEqual([])
  })

  beforeEach(() => {
    process.env.IDIOMA_ITALIANO = '1'
  })
  afterEach(() => {
    delete process.env.IDIOMA_ITALIANO
  })

  for (const p of PANTALLAS) {
    it(`${p.nombre} · sin frases espanolas ni inglesas de las listas`, async () => {
      const html = texto(await p.pintar('it'))
      expect(p.espanol.filter((f) => html.includes(f) && !COMUNES_IT.has(f))).toEqual([])
      expect(p.ingles.filter((f) => html.includes(f) && !COMUNES_IT.has(f) && !AJENAS_IT.has(f))).toEqual([])
      expect((p.italiano ?? []).filter((f) => !html.includes(f))).toEqual([])
    })
    it(`${p.nombre} · sin formatos espanoles ni ingleses`, async () => {
      expect(huellasEnItaliano(await p.pintar('it'), { permitidos: PERMITIDOS_IT })).toEqual([])
    })
  }

  it('barrido: ningun trozo espanol ni ingles de `catalogos.*` en el HTML italiano', async () => {
    const { ES_CATALOGOS, EN_CATALOGOS, IT_CATALOGOS } = await import('./textos/catalogos')
    const IT = IT_CATALOGOS as Record<string, string | undefined>
    let html = ''
    for (const p of PANTALLAS) {
      forzado.cola = []
      datos.sitios = []
      html += legible(await p.pintar('it'))
    }
    // Los nombres de los datos de prueba no son texto de la interfaz.
    // Ni lo que pinta OTRO ambito y aun cae al ingles («Dayparts and seasons»
    // contiene el «Dayparts» de este lote).
    const ajenas = [...AJENAS_IT].map((x) => x.replace(/^title="|"$|^>|<\/option>$/g, ''))
    for (const a of ['Pantalla Reforma', 'Pantalla Sur', 'Pantalla Norte', 'Paquete Centro', 'Paquete Viejo', 'Buen Fin 2026', 'Navidad 2025', 'Madrugada', 'Mañana', 'Tarde', 'Verano', 'Otoño', 'Invierno', 'aviso-del-servidor', 'error-de-prueba', ...ajenas]) {
      html = html.split(a).join('\n')
    }
    const culpables: string[] = []
    let vistos = 0
    for (const [clave, es] of Object.entries(ES_CATALOGOS)) {
      const it = IT[clave] ?? ''
      const en = EN_CATALOGOS[clave as keyof typeof EN_CATALOGOS]
      for (const [lado, frase] of [['es', es], ['en', en]] as const) {
        for (const trozo of frase.split(/\{\w+\}/)) {
          const t = trozo.trim()
          if (t.length < 8 || it.includes(t)) continue
          if (html.includes(t)) culpables.push(`${clave} · ${lado} «${t}»`)
        }
      }
      if (it && it.split(/\{\w+\}/).some((t) => t.trim().length >= 8 && html.includes(t.trim()))) vistos++
    }
    expect(culpables).toEqual([])
    expect(vistos).toBeGreaterThan(100)
  })
})
