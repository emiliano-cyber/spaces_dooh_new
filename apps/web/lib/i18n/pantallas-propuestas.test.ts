import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { traducir } from './diccionario'
import { huellasDeFormatoEspanol } from './guardias-ingles'
import { huellasEnItaliano } from './guardias-italiano'
import { huellasEnPortugues } from './guardias-portugues'
import { culpablesEnItaliano } from '../test/barrido-italiano'
import { espanolPendienteDeOtrosLotes } from '../test/barrido-portugues'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProveedorIdioma } from './contexto'
import type { Idioma } from './idiomas'
import { MONEDAS, fijarMonedaInstancia } from './dinero'
import { leerDinero } from './simbolo-en-pantalla'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

// ============================================================================
//  I18N · LOTE PILOTO «PROPUESTAS», RENDIDO DE VERDAD EN LOS DOS IDIOMAS.
// ----------------------------------------------------------------------------
//  Mismo patron que `pantallas.test.ts` (login y menu): se monta el componente
//  REAL dentro del proveedor, se rinde a HTML con `renderToStaticMarkup` y se
//  comprueba el texto. Dos cosas por pantalla:
//
//    (a) en ESPANOL sale el texto de siempre, letra por letra;
//    (b) en INGLES no queda NINGUNA frase espanola del lote.
//
//  Va en archivo aparte, y no dentro de `pantallas.test.ts`, por una razon
//  concreta: aqui se sustituye `useState` (ver abajo) y ese truco no debe
//  alcanzar a las pruebas del login y del menu.
//
//  ─── POR QUE SE FUERZA `useState` ──────────────────────────────────────────
//
//  `renderToStaticMarkup` no ejecuta efectos ni clics: un dialogo que se abre
//  al pulsar «Nueva propuesta», una fila que se despliega o un tablero que pide
//  sus cifras en un `useEffect` NO se pintan nunca. Sin DOM (este repo no tiene
//  jsdom, a proposito: `vitest.config.ts`), la unica forma de rendir esas
//  ramas es arrancar el estado ya en el valor que tendrian tras el clic. Para
//  eso `useState` se envuelve: si hay un valor FORZADO en la cola y su
//  predicado casa con el valor inicial de la llamada, se usa ese. Todo lo demas
//  es el `useState` de React sin tocar.
//
//  ─── LOS MODULOS COMPARTIDOS (lote «compartidos», 2026-11-02) ─────────────
//
//  Los textos que llegan de modulos compartidos (`lib/periodos.ts`,
//  `lib/codigo-aprobacion.ts`, `AvisoFranjaCMS`, `OPCIONES_PERIODO`, las
//  periodicidades de renta, la calculadora) ya se traducen, y se comprueban
//  aqui de dos formas: frases suyas en las listas de cada pantalla, y un
//  segundo barrido con el diccionario entero de `textos/compartidos.ts`. Lo
//  que `MapView` y los controles de `components/demo/ui/` pintan se mide en
//  `pantallas-compartidos.test.ts`, porque aqui el mapa va sustituido. Los
//  mensajes de error que manda el servidor van por I18N-05.
// ============================================================================

const forzado = vi.hoisted(() => ({
  cola: [] as Array<{ si: (inicial: unknown) => boolean; valor: unknown }>,
}))

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
  usePathname: () => '/propuestas',
  notFound: () => {
    throw new Error('notFound')
  },
}))

const cabeceras = vi.hoisted(() => ({ cookie: null as string | null, accept: null as string | null }))
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (n: string) =>
      n === 'spaces_idioma' && cabeceras.cookie ? { value: cabeceras.cookie } : undefined,
  }),
  headers: () => ({
    get: (n: string) => (n === 'accept-language' ? cabeceras.accept : null),
  }),
}))

// El modal real va por un portal de Radix, que en el servidor no pinta nada.
// Se sustituye por su contenido en linea: lo que se mide es el TEXTO.
vi.mock('@/components/demo/ui/Modal', () => ({
  Modal: (p: { open: boolean; title: string; subtitle?: string; children: unknown; footer?: unknown }) =>
    p.open
      ? createElement(
          'div',
          null,
          createElement('h2', null, p.title),
          p.subtitle ? createElement('p', null, p.subtitle) : null,
          p.children as never,
          p.footer as never,
        )
      : null,
}))

// La tarjeta plegable recuerda su estado en el navegador y puede arrancar
// plegada: aqui se pinta siempre entera.
vi.mock('@/components/demo/ui/CardColapsable', () => ({
  CardColapsable: (p: { titulo: string; subtitulo?: unknown; resumen?: unknown; accion?: unknown; children?: unknown }) =>
    createElement(
      'section',
      null,
      createElement('h3', null, p.titulo),
      p.subtitulo as never,
      p.resumen as never,
      p.accion as never,
      p.children as never,
    ),
}))

// MapLibre no existe en node, y el mapa no lleva texto del lote.
vi.mock('@/components/demo/MapView', () => ({ MapView: () => createElement('div', null, '[mapa]') }))

vi.mock('@/components/demo/shell/SesionContext', () => ({ usePuede: () => true }))

// ─── Datos de prueba ────────────────────────────────────────────────────────
const SITIO_DIGITAL = {
  id: 's1', nombre: 'Pantalla Reforma', tipoMedio: 'PANTALLA_DIGITAL', esRotativo: false,
  exhibicion: 'digital', estatusComercial: 'DISPONIBLE', lat: 19.4, lng: -99.1, alcaldia: 'Cuauhtémoc',
  propio: false, totalSpots: 8, spotsDisponibles: 6, duracionSpotSeg: 10, horario: 'basura',
  modalidadesDetalle: [{ unidad: 'spot', tarifaPublicada: 1000 }], tarifaPublicada: 0,
  arrendadorId: null, predioId: null, cpm: null,
}
const SITIO_FIJO = {
  id: 's2', nombre: 'Muro Insurgentes', tipoMedio: 'ESPECTACULAR', esRotativo: false,
  exhibicion: 'fija', estatusComercial: 'DISPONIBLE', lat: 0, lng: 0, alcaldia: 'Benito Juárez',
  propio: true, totalSpots: null, spotsDisponibles: null, duracionSpotSeg: null, horario: '',
  modalidadesDetalle: [{ unidad: 'mensual', tarifaPublicada: 5000 }], tarifaPublicada: 5000,
  arrendadorId: null, predioId: null,
}
const ITEM_BASE = {
  propuestaId: 'p1', fechaInicio: '2026-11-01', fechaFin: '2026-11-30', unidad: 'mensual', cantidad: 1,
  tarifaUnitaria: 1000, spotsPorDia: null, franjaId: null,
}
const PROPUESTA = {
  id: 'p1', folio: 'PR-0001', tokenPublico: 'tok', clienteId: 'c1', agenciaId: 'a1', nombre: 'Campaña Navidad',
  fecha: '2026-10-01', estatus: 'ENVIADA', comisionPct: 15, descuentoPct: 5, version: 2, notas: null,
  creadoEn: '2026-10-01', condiciones: 'Pago a 30 días.', vigenteHasta: '2026-12-01', vencida: false,
  items: [
    { ...ITEM_BASE, id: 'i1', sitioId: 's1', precio: 1000, aprobado: true, precioAjustadoPor: 'u1',
      tarifaCalculada: 900, precioAjustadoPorNombre: null },
    { ...ITEM_BASE, id: 'i2', sitioId: 's2', precio: 5000, aprobado: false },
  ],
  bruto: 6000, descuentoVolumenPct: 2.5, descuentoVolumenMonto: 150,
  paquete: { nombre: 'Combo', precio: 5500, admiteCodigo: false, avisoComposicion: null,
    sitios: [{ sitioId: 's1', parte: 1000 }] },
  brutoConVolumen: 5850, descuentoMonto: 100, codigoTexto: 'VERANO20', codigoDescuentoPct: 20,
  codigoDescuentoMonto: 50, codigoEstado: 'PENDIENTE', baseComercial: 5750, base: 5700, divisor: 0.85,
  neto: 4845, iva: 912, total: 6612, itemsAprobados: 1, brutoAprobado: 1000, descuentoVolumenMontoAprobado: 0,
  codigoDescuentoMontoAprobado: 0, baseAprobado: 1000, netoAprobado: 850, ivaAprobado: 160, totalAprobado: 1160,
}
const CLIENTES = [
  { id: 'c1', nombre: 'Refrescos del Norte', tipo: 'DIRECTO', ivaPct: 8, agenciaId: null,
    contacto: { email: 'compras@norte.mx' } },
  { id: 'a1', nombre: 'Agencia Uno', tipo: 'AGENCIA', ivaPct: 16, comisionAgenciaPct: 15,
    tieneNegociacion: true, negociacionValidada: false },
]
const FUNNEL = {
  total: 4, borrador: 1, enviadas: 1, aprobadas: 1, rechazadas: 1, pipelineValue: 12000,
  ganadoValue: 8000, perdidoValue: 3000, winRate: 0.5, conversion: 0.5,
}

const datos = vi.hoisted(() => ({ propuestas: [] as unknown[], contratos: [] as unknown[] }))
vi.mock('@/lib/data/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/data/client')>()
  return {
    ...real,
    usePropuestas: () => datos.propuestas,
    useFunnelPropuestas: () => FUNNEL,
    useClientes: () => CLIENTES,
    useSitios: () => [SITIO_DIGITAL, SITIO_FIJO],
    useCampanas: () => [],
    useContratos: () => datos.contratos,
    useArrendadores: () => [{ id: 'ar1', nombre: 'Don Pepe' }],
    useReservas: () => [],
    useConfigNegocio: () => ({ topeDescuentoPct: 30, spotSeg: 10 }),
  }
})

// El documento imprimible es un Server Component con sesion y base: se le dan
// las respuestas que necesita para pintar.
vi.mock('@/lib/server/auth', () => ({ exigir: async () => ({ ok: true }) }))
vi.mock('@/lib/server/db', () => ({ q1: async () => ({ token_publico: 'tok' }) }))
vi.mock('@/lib/server/tenant', () => ({ tenantActual: async () => 't1' }))
// ADR 0048 · el documento imprimible pide la moneda de la instancia a la base.
vi.mock('@/lib/server/moneda-instancia', () => ({ monedaDeLaInstancia: async () => 'MXN' }))
// ADR 0049 · el documento imprimible va en el idioma de los DOCUMENTOS de la
// instancia. Por omision aqui es el MISMO que el de la peticion, para que los
// casos de siempre sigan midiendo la traduccion de cada idioma; el caso
// «instancia espanola, persona en ingles» lo fija aparte.
const instancia = vi.hoisted(() => ({ idioma: null as null | 'es' | 'en' | 'it' }))
vi.mock('@/lib/server/idioma-instancia', () => ({
  idiomaDeLaInstancia: async () => instancia.idioma ?? cabeceras.cookie ?? 'es',
}))
vi.mock('@/lib/server/propuestas-repo', () => ({
  obtenerPropuestaPublica: async () => ({
    ...PROPUESTA, orgNombre: 'Medios SA', orgLogoUrl: null, clienteNombre: 'Refrescos del Norte',
    agenciaNombre: 'Agencia Uno', aceptadoEn: null, aceptadoPor: null,
    items: [
      { sitioNombre: 'Pantalla Reforma', fechaInicio: '2026-11-01', fechaFin: '2026-11-30', precio: 1000,
        lat: 19.4, lng: -99.1, alcaldia: 'Cuauhtémoc', ciudad: 'CDMX', estado: null, direccion: 'Reforma 1',
        tipoMedio: 'PANTALLA_DIGITAL', franjaId: 'f1', franjaNombre: null, franjaHorario: null },
      { sitioNombre: 'Muro', fechaInicio: '2026-11-01', fechaFin: '2026-11-30', precio: 5000,
        lat: null, lng: null, tipoMedio: 'ESPECTACULAR', franjaId: null },
    ],
  }),
}))

beforeEach(() => {
  process.env.IDIOMA_INGLES = '1'
  forzado.cola = []
  datos.propuestas = [PROPUESTA]
  datos.contratos = []
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
})

function pintar(idioma: Idioma, el: ReactElement): string {
  return renderToStaticMarkup(createElement(ProveedorIdioma, { idioma, puedeElegir: true }, el))
}

// El HTML escapa comillas y apostrofos; se comparan textos, no marcado.
function texto(html: string): string {
  return html
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

const forzar = (si: (v: unknown) => boolean, valor: unknown) => forzado.cola.push({ si, valor })

// Pinta el arbol del idioma que recibe (ver el documento imprimible abajo).
function SegunIdioma(p: { idioma: Idioma; en: ReactElement; it?: ReactElement; pt?: ReactElement }): ReactElement {
  if (p.idioma === 'it' && p.it) return p.it
  if (p.idioma === 'pt' && p.pt) return p.pt
  return p.en
}
const esNull = (v: unknown) => v === null
const esFalse = (v: unknown) => v === false

// ─── Las pantallas ──────────────────────────────────────────────────────────
type Pantalla = {
  nombre: string
  pintar: (idioma: Idioma) => Promise<string>
  /** Texto espanol que TIENE que salir en `es` (y no en `en`). */
  espanol: string[]
  /** Texto ingles que tiene que salir en `en`. */
  ingles: string[]
  /** Texto italiano que tiene que salir en `it` (lote L2, 2026-11-03). */
  italiano?: string[]
}

const PANTALLAS: Pantalla[] = [
  {
    nombre: 'lista de propuestas (con una fila desplegada)',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/propuestas/page')
      forzar(esNull, null) // modo
      forzar(esNull, 'p1') // abierta
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Cotizaciones con método del divisor (bruto / neto)',
      'Nueva propuesta',
      'En pipeline',
      '2 propuestas en borrador o enviadas · total c/IVA',
      'Enviadas sin respuesta',
      'esperan que el cliente apruebe o rechace',
      'Ganado (histórico)',
      '1 aprobada · perdido',
      'en 1 rechazada',
      'Tasa de cierre histórica',
      'aprobadas sobre 2 cerradas, desde siempre',
      'Lista de propuestas',
      'Todos los clientes',
      'Folio o nombre…',
      'Embudo histórico',
      'Perdidas',
      'Cupón pendiente',
      'El código VERANO20 espera aprobación; el cliente todavía no lo ve',
      ' · vía ',
      '2 sitios',
      'total c/IVA',
      'Abrir',
      'Bruto (lista)',
      'Comisión 15% · divisor 0.85',
      'Neto propuesto',
      'Aprobado · 1/2 sitios',
      'Neto aprobado',
      'aprobado',
      'Rechazar',
      'Resumen de propuestas',
    ],
    ingles: ['New proposal', 'Proposal list', 'All clients', 'Historical funnel', 'Negotiation code pending', 'Nov 1, 2026 – Nov 30, 2026'],
  },
  {
    nombre: 'nueva propuesta (el dialogo de alta)',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/propuestas/page')
      forzar(esFalse, true) // nuevoOpen
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Selecciona sitios; el método del divisor calcula bruto → neto',
      'Nombre de la propuesta',
      '— Sin cliente —',
      '— Sin agencia (directo) —',
      'Duración de la campaña',
      'Hasta (se calcula de la duración, o escríbela)',
      'Comisión de la agencia (%)',
      'Sitios (0)',
      'Lista',
      'Mapa',
      'Fija',
      'Crear propuesta',
      'Total c/IVA:',
      'Divisor (0%)',
    ],
    ingles: ['Create proposal', 'Proposal name', 'Campaign duration'],
  },
  {
    nombre: 'duplicar propuesta (con la contratacion por sitio)',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/propuestas/page')
      forzar(esNull, { tipo: 'duplicar', propuesta: PROPUESTA })
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Duplicar propuesta',
      // Lote compartidos
      'CPS · costo por salida',
      'Catorcenal (cada 14 días)',
      'title="Nº de salidas"',
      '>semana<',
      'Mismos sitios y contratación; los precios se calculan con la tarifa de hoy.',
      'La negociación con «Agencia Uno» no está validada',
      'Valida la negociación de la agencia en Clientes para poder crear la propuesta.',
      'Contratación por sitio',
      'Calculadora de spots',
      'Apagada: la cantidad de spots se captura a mano.',
      'Renta al arrendador',
      'Arrendador…',
      '⚠ Falta el importe: el contrato nacerá pendiente y no se generará el calendario de pagos.',
      'Pantalla propia',
      'sin renta · su costo es luz y operación',
      'Fija · sin spots',
      'Sitios (2)',
    ],
    ingles: [
      'Duplicate proposal', 'Per-site booking', 'Spot calculator', 'Rent to landlord',
      // Lote compartidos: unidades, periodicidad de renta y el titulo de la cantidad.
      'CPS · cost per play', 'Every two weeks', 'title="No. of plays"', '>week<',
    ],
  },
  {
    nombre: 'agregar sitios a una propuesta',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/propuestas/page')
      forzar(esNull, { tipo: 'agregar', propuesta: PROPUESTA })
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Agregar sitios a «Campaña Navidad»',
      'Ya está enviada: agregar sitios sube la versión (renegociación).',
      'Periodo de la propuesta:',
      'Los sitios nuevos se cotizan con esas fechas y con la tarifa de hoy.',
      'Agregar sitios',
    ],
    ingles: ['Add sites to “Campaña Navidad”', 'Proposal period:'],
  },
  {
    nombre: 'ficha de la propuesta',
    pintar: async (idioma) => {
      const { default: Ficha } = await import('../../app/(app)/(shell)/propuestas/[id]/page')
      return pintar(idioma, createElement(Ficha, { params: { id: 'p1' } }))
    },
    espanol: [
      'Válida hasta 01/12/2026',
      'Folio interno:',
      '· el cliente accede solo por la liga (token)',
      'Copiar liga',
      'Duplicar',
      'Generar PDF',
      'Reenviar',
      'Aprobar',
      'Rechazar',
      'Fechas',
      'Anunciante',
      'Agencia</div>', // el rotulo, no el nombre del cliente «Agencia Uno»
      'Comisión',
      'Resumen económico',
      'Total c/IVA',
      'lo que paga el cliente · 2 sitios',
      'Neto para el medio',
      'después de 15% de comisión de agencia',
      'Renta de referencia',
      'ninguna pantalla tiene renta capturada',
      'total c/IVA · 1 de 2 sitios',
      'Bruto (tarifa de lista)',
      'Paquete "Combo" — precio del conjunto',
      'Descuento por volumen (2.5%)',
      'Descuento comercial (5.00%)',
      'Código VERANO20 (20%) · cupón pendiente de aprobación',
      'Base con descuento',
      'Comisión de agencia (15%) · divisor ×0.85',
      'Neto (para el medio)',
      'Total que paga el cliente',
      'Sobre lo aprobado · 1/2 sitios',
      'Descuento comercial',
      'Rebaja sobre la tarifa de lista (distinta de la comisión de agencia).',
      'sube la versión (renegociación).',
      'Tu organización autoriza hasta',
      'Administración tiene que subir el tope.',
      'versión actual: v2',
      'Paquete cerrado',
      'Esta propuesta se vende como el paquete',
      'Es precio final: no admite descuento por volumen ni código de negociación.',
      'Quitar paquete',
      'Quitarlo devuelve los precios de lista de cada pantalla.',
      'Sitios y renta',
      'Renta total ref.',
      'Ya está enviada: agregar o quitar sitios sube la versión.',
      'Arrendador · renta',
      'Contratación',
      'Precio propuesta',
      'Sin contrato de renta',
      'Tarifa calculada',
      ' · ajustada por ',
      'un usuario dado de baja',
      'Quitar de la propuesta',
      'Condiciones y vigencia',
      'Ubicación de las pantallas',
      '1 de 2 pantallas no tienen coordenadas y no aparecen en el mapa.',
      'Borrador',
      'Enviada',
    ],
    ingles: [
      'Internal ref.:',
      'Copy link',
      'Financial summary',
      'Sites and rent',
      'Draft',
      'Sent',
      // Fecha en formato ingles, sin ambiguedad (decision del dueno, 2026-11-02).
      'Valid until Dec 1, 2026',
      'Negotiation code VERANO20 (20%) · pending approval',
      'to go higher, an admin has to raise the cap in Settings',
      'Screens without coordinates (not shown on the map): 1 of 2 screens.',
    ],
  },
  {
    nombre: 'bloque del codigo promocional, pendiente',
    pintar: async (idioma) => {
      const { BloqueCodigoPropuesta } = await import('../../components/demo/codigos/BloqueCodigoPropuesta')
      return pintar(
        idioma,
        createElement(BloqueCodigoPropuesta, {
          propuestaId: 'p1', estatus: 'ENVIADA', codigoTexto: 'VERANO20', codigoDescuentoPct: 20,
          codigoEstado: 'PENDIENTE', puedeEditar: true,
        }),
      )
    },
    espanol: [
      'Código de negociación',
      'Esta propuesta lleva el código',
      'que ya está congelado: si el código cambia o se borra, este precio no se mueve.',
      'El cliente todavía no lo ve:',
      'Mientras esté pendiente, la propuesta no se puede aprobar por dentro.',
      'Quitar código',
      'Quitarlo devuelve su uso al cupón.',
      'Pendiente de aprobación', // lote compartidos: `etiquetaEstadoCodigo`
    ],
    ingles: ['Negotiation code', 'Remove code', '<b>20%</b> off, locked in', 'Pending approval'],
  },
  {
    nombre: 'bloque del codigo promocional, sin codigo y rechazada',
    pintar: async (idioma) => {
      const { BloqueCodigoPropuesta } = await import('../../components/demo/codigos/BloqueCodigoPropuesta')
      return pintar(
        idioma,
        createElement(BloqueCodigoPropuesta, {
          propuestaId: 'p1', estatus: 'RECHAZADA', codigoTexto: null, codigoDescuentoPct: 0,
          codigoEstado: null, puedeEditar: true,
        }),
      )
    },
    espanol: [
      'Se aplica',
      'del descuento comercial y se',
      'con él: un 20 % y un 20 % dejan al cliente pagando el 64 %, no el 60 %.',
      'pendiente de aprobación',
      'Esta propuesta está rechazada:',
      'aplicar un cupón la reactiva a borrador.',
      'Aplicar',
    ],
    ingles: ['Apply'],
  },
  {
    nombre: 'condiciones y vigencia',
    pintar: async (idioma) => {
      const { BloqueCondicionesVigencia } = await import('../../components/demo/propuestas/BloqueCondicionesVigencia')
      return pintar(
        idioma,
        createElement(BloqueCondicionesVigencia, {
          propuestaId: 'p1', condiciones: null, vigenteHasta: '2026-12-01', vencida: false, editable: true,
        }),
      )
    },
    espanol: [
      'Vigencia',
      'El cliente puede aceptarla hasta el 01/12/2026 (ese día incluido).',
      'Términos y condiciones',
      'Salen al final del documento y en la liga del cliente.',
      'Sin condiciones: el documento no lleva este bloque.',
      'Guardar',
    ],
    ingles: ['Validity', 'Terms and conditions', 'The client can accept it until Dec 1, 2026 (inclusive).'],
  },
  {
    nombre: 'enviar propuesta',
    pintar: async (idioma) => {
      const { EnviarPropuestaDialog } = await import('../../components/demo/propuestas/EnviarPropuestaDialog')
      return pintar(
        idioma,
        createElement(EnviarPropuestaDialog, {
          open: true, onOpenChange: () => {}, propuestaId: 'p1', correoCliente: null, reenvio: true,
          onSinCorreo: () => {},
        }),
      )
    },
    espanol: [
      'Reenviar propuesta',
      'El cliente recibe la liga para revisarla y aceptarla. Tú recibes copia.',
      'Correo del cliente',
      'Mensaje (opcional)',
      'Unas líneas para el cliente; van antes del botón de la liga.',
      'Si la propuesta ya venció, reenviarla le da una vigencia nueva.',
    ],
    ingles: ['Resend proposal', 'Client email'],
  },
  {
    nombre: 'elegir cliente',
    pintar: async (idioma) => {
      const { ElegirClienteDialog } = await import('../../components/demo/propuestas/ElegirClienteDialog')
      return pintar(
        idioma,
        createElement(ElegirClienteDialog, {
          open: true, onOpenChange: () => {}, clientes: CLIENTES as never, onElegir: async () => {},
        }),
      )
    },
    espanol: [
      '¿A qué cliente se le factura?',
      'La propuesta se aprobó sin cliente. Elígelo para generar la campaña; después ya no se cambia.',
      'Poner cliente y generar campaña',
      '— Elige el cliente —',
      'Refrescos del Norte (IVA 8 %)',
    ],
    ingles: ['Which client should be billed?', 'Set client and generate campaign'],
  },
  {
    nombre: 'tablero de propuestas por periodo',
    pintar: async (idioma) => {
      const { TableroPropuestas } = await import('../../components/demo/propuestas/TableroPropuestas')
      forzar(esNull, {
        periodo: { etiqueta: 'Noviembre 2026', desde: '2026-11-01', hasta: '2026-11-30' },
        conGanancia: true,
        resumen: {
          generadas: 3, rechazadas: 1, tasaCierre: 0.5,
          aprobadas: { n: 2, venta: 0, ganancia: null, margenPct: null, gananciaPromedio: null, sinCosto: 2 },
          porVendedor: [{ vendedor: 'Ana', generadas: 3, aprobadas: 2, rechazadas: 1, venta: 0, ganancia: 0 }],
          lista: [{ id: 'p1', folio: 'PR-0001', nombre: 'Campaña Navidad', vendedor: null, aprobada: '2026-11-02',
            venta: null, costoRenta: null, ganancia: null }],
        },
      })
      return pintar(idioma, createElement(TableroPropuestas))
    },
    espanol: [
      'Resumen de propuestas',
      'Generadas',
      'creadas en el periodo',
      'venta —, sin calcular en estas propuestas',
      'Tasa de cierre del periodo',
      'aprobadas de las decididas en este periodo',
      'Ganancia por aprobada',
      'sin calcular: falta la venta o la renta',
      'venta − renta de las pantallas',
      '2 aprobadas tienen alguna pantalla sin contrato de renta vigente: cuentan en la venta, pero no en la ganancia.',
      'Vendedor',
      'Venta sin IVA',
      'Aprobadas del periodo',
      'sin contrato',
      // Lote compartidos: `OPCIONES_PERIODO` y la etiqueta del periodo.
      'Este mes',
      'Mes pasado',
      'Trimestre pasado',
      'Rango',
      'Noviembre 2026 · ',
    ],
    ingles: [
      'Proposal summary', 'Sales rep', 'Sales excl. VAT', 'Approved on', 'Nov 2, 2026', 'Internal ref.',
      'This month', 'Last month', 'This quarter', 'Last quarter', 'This year', 'Custom range',
      'November 2026 · Nov 1, 2026',
    ],
  },
  {
    nombre: 'entrada publica por codigo',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/propuesta/page')
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Propuestas comerciales',
      'Ver tu propuesta',
      'Ingresa el código que te compartimos para ver tu propuesta.',
      'p. ej. PR-A0BC4F',
      'Ver propuesta',
      'Spaces · propuestas comerciales · acceso de solo lectura por código',
    ],
    ingles: ['View your proposal', 'View proposal'],
  },
  {
    nombre: 'barra y QR del documento imprimible',
    pintar: async (idioma) => {
      const { BarraDocumentoPropuesta, LigaConQr } = await import(
        '../../components/demo/propuestas/DocumentoPropuestaCliente'
      )
      forzar((v) => v === '', 'https://ejemplo.mx/spaces-dooh/p/tok/') // liga
      return pintar(
        idioma,
        createElement(
          'div',
          null,
          createElement(BarraDocumentoPropuesta, { volverA: '/propuestas/p1' }),
          createElement(LigaConQr, { token: 'tok', aceptable: true }),
        ),
      )
    },
    espanol: [
      'Volver a la propuesta',
      'Imprimir o guardar como PDF',
      'En el diálogo de impresión elige «Guardar como PDF». Espera a que cargue el mapa antes de imprimir.',
      'Acéptala en línea',
      'Escanea el código o abre esta dirección para revisar la propuesta y aceptarla:',
    ],
    ingles: ['Back to the proposal', 'Accept it online'],
  },
  {
    nombre: 'documento imprimible (Server Component)',
    pintar: async (idioma) => {
      // El idioma de un Server Component lo decide `idiomaDeLaPeticion()`,
      // como en el layout raiz: aqui entra por la cookie.
      cabeceras.cookie = idioma
      const { default: Documento } = await import('../../app/(app)/propuesta/[id]/page')
      // En italiano, el italiano encendido: si no, la cookie 'it' se trata
      // como un idioma que no hablamos y el documento sale en espanol.
      const previo = process.env.IDIOMA_ITALIANO
      if (idioma === 'it') process.env.IDIOMA_ITALIANO = '1'
      // Lo mismo en portugues (lote L2, 2026-11-05).
      const previoPt = process.env.IDIOMA_PORTUGUES
      if (idioma === 'pt') process.env.IDIOMA_PORTUGUES = '1'
      const el = await Documento({ params: { id: 'p1' } })
      if (previo === undefined) delete process.env.IDIOMA_ITALIANO
      else process.env.IDIOMA_ITALIANO = previo
      if (previoPt === undefined) delete process.env.IDIOMA_PORTUGUES
      else process.env.IDIOMA_PORTUGUES = previoPt
      // Italiano, lote L2 (2026-11-03): el espejo (`I18N_VOLCAR_IT`) rinde en
      // italiano el arbol que la prueba construyo en ingles, pero el texto de
      // un Server Component ya esta escrito en ese arbol —lo decidio la cookie—
      // y el espejo no puede cambiarlo. Solo cuando se pide el espejo, se
      // construye TAMBIEN el arbol italiano y se envuelve en `SegunIdioma`,
      // que pinta el del idioma que recibe: el ingles sale identico y el
      // espejo, al cambiar `idioma` a 'it', pinta el italiano de verdad.
      if (idioma === 'en' && process.env.I18N_VOLCAR_IT) {
        const antes = process.env.IDIOMA_ITALIANO
        process.env.IDIOMA_ITALIANO = '1'
        cabeceras.cookie = 'it'
        const elIt = await Documento({ params: { id: 'p1' } })
        cabeceras.cookie = idioma
        if (antes === undefined) delete process.env.IDIOMA_ITALIANO
        else process.env.IDIOMA_ITALIANO = antes
        return pintar(idioma, createElement(SegunIdioma, { idioma, en: el, it: elIt }))
      }
      // Y el espejo portugues (`I18N_VOLCAR_PT`, lote L2 del portugues): el
      // mismo truco con el arbol portugues. Sin el espejo no entra.
      if (idioma === 'en' && process.env.I18N_VOLCAR_PT) {
        const antes = process.env.IDIOMA_PORTUGUES
        process.env.IDIOMA_PORTUGUES = '1'
        cabeceras.cookie = 'pt'
        const elPt = await Documento({ params: { id: 'p1' } })
        cabeceras.cookie = idioma
        if (antes === undefined) delete process.env.IDIOMA_PORTUGUES
        else process.env.IDIOMA_PORTUGUES = antes
        return pintar(idioma, createElement(SegunIdioma, { idioma, en: el, pt: elPt }))
      }
      // Las piezas de cliente del documento (la barra, el QR) leen el idioma
      // del proveedor que pone el layout raiz; aqui se pone igual.
      return pintar(idioma, el)
    },
    espanol: [
      'PROPUESTA COMERCIAL',
      'Para',
      ' · vía Agencia Uno',
      'Periodo',
      'Vigencia',
      'Válida hasta el 01/12/2026',
      'PANTALLAS',
      'Pantalla y ubicación',
      'Importe',
      'Sin foto',
      '· Franja',
      'UBICACIÓN',
      '1 pantalla(s) sin coordenadas; su dirección está en la tabla.',
      'IMPORTE',
      'Bruto (tarifa de lista)',
      'Descuento (5%)',
      'Comisión de agencia (15%)',
      'TÉRMINOS Y CONDICIONES',
      'ACEPTA EL CLIENTE',
      'Nombre, firma y fecha',
      'La franja horaria es un compromiso comercial: se cotiza y se cobra.', // lote compartidos
    ],
    ingles: [
      'COMMERCIAL PROPOSAL', 'SCREENS', 'CLIENT ACCEPTANCE', 'Valid until Dec 1, 2026', 'Prepared for',
      'The daypart is a commercial commitment: it is quoted and billed.',
    ],
  },
  {
    nombre: 'lista filtrada sin resultados',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/propuestas/page')
      const esVacio = (v: unknown) => v === ''
      forzar(esVacio, 'APROBADA') // filtroEstatus
      forzar(esVacio, 'c1') // filtroCliente
      forzar(esVacio, 'xyz') // busqueda
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['Ninguna propuesta aprobada de Refrescos del Norte que coincida con «xyz». Quita el filtro para ver las 1.'],
    ingles: ['Clear the filter'],
  },
  {
    nombre: 'lista vacia',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/propuestas/page')
      datos.propuestas = []
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['Aún no hay propuestas. Arma la primera con «Nueva propuesta».'],
    ingles: ['No proposals yet.'],
  },
  {
    // Segunda vuelta (validador, M10): ningun estado enseñaba un motivo de
    // rechazo de la calculadora, asi que quitar el `idioma` de
    // `previsualizarCalculadora` en el alta sobrevivia. Una linea pide 9
    // espacios a una pantalla de 8.
    nombre: 'calculadora de spots con una linea invalida',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/propuestas/page')
      forzar(esNull, { tipo: 'duplicar', propuesta: PROPUESTA })
      forzar((v) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0, {
        s1: {
          unidad: 'spot', cantidadManual: 1, spotsPorDia: '', rentaMonto: '', rentaPeriodicidad: 'MENSUAL',
          rentaArrendadorId: '', franjaId: '', tarifaManual: '', manual: false, espacios: '9', horasDia: '',
          roadblock: false, prima: '',
        },
      })
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['Los espacios del loop van de 1 a 8.'],
    ingles: ['Loop slots go from 1 to 8.'],
  },
  {
    // Segunda vuelta: con un rango a mano la etiqueta YA son las fechas; en
    // ingles se pintan una vez, en espanol como siempre.
    nombre: 'tablero de propuestas con un rango a mano',
    pintar: async (idioma) => {
      const { TableroPropuestas } = await import('../../components/demo/propuestas/TableroPropuestas')
      forzar(esNull, {
        periodo: { etiqueta: '2026-01-05 a 2026-03-09', desde: '2026-01-05', hasta: '2026-03-09' },
        conGanancia: false,
        resumen: {
          generadas: 0, rechazadas: 0, tasaCierre: null,
          aprobadas: { n: 0, venta: 0, ganancia: null, margenPct: null, gananciaPromedio: null, sinCosto: 0 },
          porVendedor: [], lista: [],
        },
      })
      return pintar(idioma, createElement(TableroPropuestas))
    },
    espanol: ['2026-01-05 a 2026-03-09 · 05/01/2026 a 09/03/2026'],
    ingles: ['Jan 5, 2026 to Mar 9, 2026'],
  },
  {
    nombre: 'calculadora de spots encendida',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/propuestas/page')
      forzar(esNull, { tipo: 'duplicar', propuesta: PROPUESTA })
      forzar((v) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0, {
        s1: {
          unidad: 'spot', cantidadManual: 1, spotsPorDia: '', rentaMonto: '500', rentaPeriodicidad: 'MENSUAL',
          rentaArrendadorId: '', franjaId: '', tarifaManual: '', manual: false, espacios: '2', horasDia: '',
          roadblock: false, prima: '',
        },
      })
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Espacios del loop',
      'libres',
      'Horas al día',
      'Prima %',
      'Porcentaje encima de la tarifa por spot. Queda como ajuste a tu nombre.',
      'No se entiende el horario de la pantalla («basura»): se toman 18 h al día.',
      'La pantalla no tiene tarifa mensual: el precio por spot sale de ella. Pide a un gerente que lo ponga.',
      '⚠ La renta ($ 500.00) iguala o supera lo que le cobras al cliente ($ 0.00): la campaña saldría a pérdida. Aquí va lo que le pagas al PROPIETARIO, no el precio de venta.',
      'Programación que sale de la calculadora',
      'Salidas que salen de la calculadora de abajo',
    ],
    ingles: ['Loop slots', 'Hours per day', 'loops/h'],
  },
  {
    nombre: 'ficha de un borrador vencido, con catalogo de paquetes',
    pintar: async (idioma) => {
      const { default: Ficha } = await import('../../app/(app)/(shell)/propuestas/[id]/page')
      datos.propuestas = [
        { ...PROPUESTA, estatus: 'BORRADOR', vencida: true, paquete: null, codigoTexto: null, codigoEstado: null,
          codigoDescuentoMonto: 0, descuentoVolumenMonto: 0, itemsAprobados: 0, agenciaId: null, comisionPct: 0,
          divisor: 1 },
      ]
      forzar((v) => Array.isArray(v) && v.length === 0, [
        { id: 'k1', nombre: 'Combo', precioCerrado: 5000, sitios: [{}, {}], activo: true },
      ])
      return pintar(idioma, createElement(Ficha, { params: { id: 'p1' } }))
    },
    espanol: [
      'Vencida el 01/12/2026',
      'Directa',
      'venta directa, sin comisión',
      'ningún sitio aprobado de 2',
      'Aún no se aprueba ningún sitio: marca las casillas de la tabla «Sitios y renta».',
      'sustituye',
      'la suma de las tarifas de lista: no la descuenta, la reemplaza.',
      'Elige un paquete…',
      'Combo — ',
      ' · 2 pantallas',
      'Solo los borradores se pueden borrar',
      'Borrar',
      'Enviar',
    ],
    ingles: ['Expired on', 'Choose a bundle…'],
  },
  {
    nombre: 'ficha de una aprobada',
    pintar: async (idioma) => {
      const { default: Ficha } = await import('../../app/(app)/(shell)/propuestas/[id]/page')
      datos.propuestas = [{ ...PROPUESTA, estatus: 'APROBADA', paquete: null, codigoTexto: null, codigoEstado: null }]
      return pintar(idioma, createElement(Ficha, { params: { id: 'p1' } }))
    },
    espanol: [
      'La propuesta ya está aprobada; el descuento quedó fijo.',
      'La propuesta ya está aprobada; no admite paquete.',
      'Generar campaña',
      'Aprobada',
    ],
    ingles: ['Generate campaign', 'Approved'],
  },
  {
    // Lote COMPARTIDOS: una ficha cuyas lineas pasan por `lib/periodos.ts`
    // (la contratacion y la frecuencia), por `etiquetaCalculadora` y por la
    // periodicidad del contrato de renta.
    nombre: 'ficha con lineas de la calculadora y renta',
    pintar: async (idioma) => {
      const { default: Ficha } = await import('../../app/(app)/(shell)/propuestas/[id]/page')
      datos.contratos = [{ sitioId: 's1', montoRenta: 500, periodicidad: 'mensual', arrendadorId: 'ar1' }]
      datos.propuestas = [
        { ...PROPUESTA, paquete: null, codigoTexto: null, codigoEstado: null,
          items: [
            { ...ITEM_BASE, id: 'i3', sitioId: 's1', unidad: 'spot', cantidad: 50, tarifaUnitaria: 20, precio: 1000,
              aprobado: true, espaciosComprados: 8, horasDia: 18, roadblock: true, primaRoadblockPct: 25, spotsPorDia: 12 },
            { ...ITEM_BASE, id: 'i4', sitioId: 's2', unidad: 'cpm', cantidad: 1, tarifaUnitaria: 0, precio: 5000,
              aprobado: false, espaciosComprados: 1, horasDia: null, spotsPorDia: 1 },
          ] },
      ]
      return pintar(idioma, createElement(Ficha, { params: { id: 'p1' } }))
    },
    espanol: [
      '50 salidas × $ 20.00',
      '1 millar',
      'Roadblock · 8 espacios del loop · 18 h al día · prima 25 %',
      '1 espacio del loop',
      '12 pases al día',
      '1 pase al día',
      '$ 500.00 · mensual',
    ],
    ingles: [
      '50 plays × MX$ 20.00',
      '1 thousand',
      'Roadblock · 8 loop slots · 18 h per day · premium 25%',
      '1 loop slot',
      '12 plays per day',
      '1 play per day',
      'MX$ 500.00 · monthly',
    ],
  },
  {
    nombre: 'ficha de una propuesta que no existe',
    pintar: async (idioma) => {
      const { default: Ficha } = await import('../../app/(app)/(shell)/propuestas/[id]/page')
      return pintar(idioma, createElement(Ficha, { params: { id: 'nada' } }))
    },
    espanol: ['Propuesta no encontrada.', 'Volver a propuestas'],
    ingles: ['Proposal not found.'],
  },
  {
    // Ola 5 (recorrido en navegador): en el alta, la renta ya pactada de un
    // sitio con contrato pintaba la periodicidad CRUDA en minusculas —«MX$
    // 28,000.00 mensual»— en la pantalla inglesa. El dato es `MENSUAL`.
    nombre: 'duplicar propuesta con la renta ya pactada en el contrato',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/propuestas/page')
      datos.contratos = [
        { sitioId: 's1', montoRenta: 28000, periodicidad: 'MENSUAL', arrendadorId: 'ar1', estatus: 'VIGENTE' },
        { sitioId: 's2', montoRenta: 3000, periodicidad: 'CATORCENAL', arrendadorId: 'ar1', estatus: 'VIGENTE' },
      ]
      forzar(esNull, { tipo: 'duplicar', propuesta: PROPUESTA })
      return pintar(idioma, createElement(Pagina))
    },
    // El español es el de siempre: el dato en minusculas, tal cual.
    espanol: ['$ 28,000.00 mensual', '$ 3,000.00 catorcenal', 'ya pactada en el contrato · costo $ 28,000.00/mes'],
    ingles: ['MX$ 28,000.00 monthly', 'MX$ 3,000.00 every two weeks'],
  },
]

describe('lote PROPUESTAS · en ESPANOL sale el texto de siempre', () => {
  PANTALLAS.forEach((p, i) => {
    it(p.nombre, async () => {
      const crudo = await p.pintar('es')
      // Con `I18N_VOLCAR=<carpeta>` el HTML espanol de cada estado va a disco:
      // es lo que se compara antes y despues de tocar los componentes.
      const dir = process.env.I18N_VOLCAR
      if (dir) {
        mkdirSync(dir, { recursive: true })
        writeFileSync(path.join(dir, `${String(i).padStart(2, '0')}-es.html`), crudo)
      }
      const html = texto(crudo)
      const faltan = p.espanol.filter((f) => !html.includes(f))
      expect(faltan).toEqual([])
    })
  })
})

describe('lote PROPUESTAS · en INGLES no queda ninguna frase espanola del lote', () => {
  for (const p of PANTALLAS) {
    it(p.nombre, async () => {
      const crudoEn = await p.pintar('en')
      const html = texto(crudoEn)
      // Las frases que coinciden en los dos idiomas (un «Roadblock», un folio,
      // un nombre de cliente) no cuentan: solo las que el ingles debe cambiar.
      const quedan = p.espanol.filter((f) => html.includes(f) && !COMUNES.has(f))
      expect(quedan).toEqual([])
      const faltan = p.ingles.filter((f) => !html.includes(f))
      expect(faltan).toEqual([])
    })
  }
})

describe('lote PROPUESTAS · barrido con el diccionario entero', () => {
  it('ninguna frase espanola del diccionario del lote aparece en las pantallas en ingles', async () => {
    // La lista de arriba es a mano y se puede quedar corta. Esta usa el
    // diccionario: de cada texto espanol del lote se sacan los trozos fijos
    // (lo que hay entre huecos) y se buscan en el HTML ingles de TODAS las
    // pantallas. Un `t()` olvidado deja su frase espanola a la vista y cae aqui.
    const { ES_PROPUESTAS, EN_PROPUESTAS } = await import('./textos/propuestas')
    // Solo lo que se LEE: nodos de texto y los atributos visibles. Las rutas
    // (`href="/propuestas/p1"`) y las clases no son texto de pantalla.
    let html = ''
    for (const p of PANTALLAS) {
      const crudo = await p.pintar('en')
      const visibles = [...crudo.matchAll(/(?:title|aria-label|placeholder|alt)="([^"]*)"/g)].map((m) => m[1])
      html += texto(crudo.replace(/<[^>]*>/g, '\n') + '\n' + visibles.join('\n'))
    }
    const culpables: string[] = []
    for (const [clave, es] of Object.entries(ES_PROPUESTAS)) {
      const en = EN_PROPUESTAS[clave as keyof typeof EN_PROPUESTAS]
      for (const trozo of es.split(/\{\w+\}/)) {
        const t = trozo.trim()
        // Trozos cortos («de», «Total») chocan con texto ingles o con datos.
        if (t.length < 8 || en.includes(t)) continue
        // El codigo de ejemplo coincide con el del dato de prueba.
        if (clave === 'propuestas.codigo.ejemplo') continue
        if (html.includes(t)) culpables.push(`${clave} · «${t}»`)
      }
    }
    expect(culpables).toEqual([])
  })

  it('ninguna frase espanola de los MODULOS COMPARTIDOS aparece en las pantallas en ingles', async () => {
    // Lote compartidos (2026-11-02). Mismo barrido, con el diccionario de
    // `textos/compartidos.ts`. Aqui los textos son CORTOS («Mensual», «Rango»,
    // «semana»), asi que el umbral baja a 4 letras y se busca la palabra
    // ENTERA: «Rango» no debe casar dentro de «Arrangement», pero «semana»
    // suelta en un `<option>` si tiene que caer.
    const { ES_COMPARTIDOS, EN_COMPARTIDOS } = await import('./textos/compartidos')
    let html = ''
    for (const p of PANTALLAS) {
      forzado.cola = []
      datos.propuestas = [PROPUESTA]
      datos.contratos = []
      const crudo = await p.pintar('en')
      const visibles = [...crudo.matchAll(/(?:title|aria-label|placeholder|alt)="([^"]*)"/g)].map((m) => m[1])
      html += texto(crudo.replace(/<[^>]*>/g, '\n') + '\n' + visibles.join('\n'))
    }
    // Las condiciones del dato de prueba («Pago a 30 días.») las escribe quien
    // vende: son DATO, no interfaz, y no se traducen.
    html = html.split('Pago a 30 días.').join('\n')
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

  it('con un rango a mano, el subtitulo ingles no repite las fechas', async () => {
    // Segunda vuelta (validador): la etiqueta del rango YA son las fechas, y el
    // subtitulo las repetia identicas en ingles.
    const p = PANTALLAS.find((x) => x.nombre === 'tablero de propuestas con un rango a mano')!
    forzado.cola = []
    const html = texto(await p.pintar('en'))
    expect(html).not.toContain('Mar 9, 2026 · Jan 5, 2026')
  })

  it('el espanol de los estatus reproduce EXACTAMENTE el label de `estatus.ts`', async () => {
    // Igual que el menu con `nav.ts`: `EST[e].label` sigue siendo la verdad en
    // espanol, y si alguien lo cambia alli esta prueba obliga a traerlo aqui.
    const { EST, CLAVE_ESTATUS, ORDEN_ESTATUS } = await import('../../components/demo/propuestas/estatus')
    const { DICCIONARIOS } = await import('./diccionario')
    for (const e of ORDEN_ESTATUS) expect(DICCIONARIOS.es[CLAVE_ESTATUS[e]]).toBe(EST[e].label)
  })
})

// Fragmentos de la lista espanola que son IGUALES en ingles a proposito: datos
// (nombres, folios) o palabras que el glosario deja sin traducir.
const COMUNES = new Set<string>([
  'Divisor (0%)', // «divisor» es el nombre del metodo, igual en los dos
  'Combo — ', // el nombre del paquete es un dato
])

// ─── El dinero: el simbolo de la moneda de la INSTANCIA (dueno, 2026-11-02) ──
//
// En ingles, una instancia MXN escribe `MX$` y una USD `$`; en espanol, MXN
// `$` y USD `US$` (la tabla de `lib/i18n/dinero.ts`). Antes de este cambio las
// pantallas traducidas llamaban `formatMonto(n)` sin idioma y el ingles de una
// instancia MXN escribia `$`: un lector anglosajon lo lee como dolares. Se
// mira el HTML pintado, con las DOS monedas y en los DOS idiomas, y se exige
// que haya importes que mirar (un arnes que no encuentra ninguno no prueba
// nada).
describe('lote PROPUESTAS · cada importe lleva el simbolo de la moneda de la instancia', () => {
  afterEach(() => fijarMonedaInstancia('MXN'))
  const vistos: Record<string, number> = {}
  for (const moneda of MONEDAS) {
    for (const idioma of ['es', 'en', 'it'] as const) {
      PANTALLAS.forEach((p) => {
        it(`${moneda} · ${idioma} · ${p.nombre}`, async () => {
          fijarMonedaInstancia(moneda)
          const { importes, ajenos } = leerDinero(texto(await p.pintar(idioma)), idioma, moneda)
          vistos[`${moneda}-${idioma}`] = (vistos[`${moneda}-${idioma}`] ?? 0) + importes
          expect(ajenos).toEqual([])
        })
      })
      it(`${moneda} · ${idioma} · el arnes encontro importes que mirar`, () => {
        expect(vistos[`${moneda}-${idioma}`] ?? 0).toBeGreaterThan(0)
      })
    }
  }
})

// Costura 2 (2026-11-02): un `formatFecha` o un `formatMonto` sin idioma no
// deja ninguna FRASE espanola, solo su formato (dd/mm/aaaa, «20 de octubre
// de 2026», «02-nov», «a. m.», «$ 1,000.00» sin MX$). El barrido de frases
// no lo ve; el ayudante comun (`lib/i18n/guardias-ingles.ts`) si, tambien en
// los `title`, `aria-label`, `placeholder` y `alt`.
describe('lote PROPUESTAS · en ingles, ninguna fecha, hora ni importe con formato espanol', () => {
  for (const p of PANTALLAS) {
    it(p.nombre, async () => {
      expect(huellasDeFormatoEspanol(await p.pintar('en'))).toEqual([])
    })
  }
})

// ─── ITALIANO · lote L2 «Comercial y propuestas» (2026-11-03) ───────────────
//
// Las mismas pantallas, rendidas en ITALIANO, en tres sentidos (el mismo
// patron que `pantallas-comercial.test.ts`):
//
//   (a) ninguna frase de las listas a mano (`espanol` / `ingles`) queda en el
//       HTML italiano, salvo las que el italiano dice igual o las de OTRO
//       ambito (otro lote: `compartidos`, `servidor`…);
//   (b) barrido con el diccionario: ningun trozo espanol NI INGLES de
//       `propuestas.*` aparece en el HTML italiano;
//   (c) ninguna huella de formato espanol o ingles (`guardias-italiano.ts`).
//
// El documento imprimible es un Server Component: su papel va en el idioma
// de la INSTANCIA (ADR 0049), que en este archivo sigue a la cookie salvo que
// se fije aparte; aqui entra como 'it' con el italiano encendido.

// Frases de las listas que en italiano se dicen IGUAL a proposito.
const COMUNES_IT = new Set<string>([
  ...COMUNES,
  'Periodo', // igual en italiano
])

// Frases inglesas de las listas que en esta pantalla NO son de este lote.
const AJENAS_IT = new Set<string>([
  'CPS · cost per play', 'Every two weeks', '>week<', // unidades: compartidos
  'Pending approval', // el chip del codigo: compartidos
  'This month', 'Last month', 'This quarter', 'Last quarter', 'This year', 'Custom range', // selector de periodo: compartidos
  'Loop slots go from 1 to 8.', // motivo de la calculadora: compartidos
  'The daypart is a commercial commitment: it is quoted and billed.', // `avisoFranja` (`lib/rejilla.ts`): compartidos
  '1 thousand', 'Roadblock · 8 loop slots · 18 h per day · premium 25%', '1 loop slot', '12 plays per day', '1 play per day', // `lib/periodos.ts`: compartidos
])

function legible(crudo: string): string {
  const visibles = [...crudo.matchAll(/(?:title|aria-label|placeholder|alt)="([^"]*)"/g)].map((m) => m[1])
  return texto(crudo.replace(/<[^>]*>/g, '\n') + '\n' + visibles.join('\n'))
}

const ITALIANO: Record<string, string[]> = {
  'lista de propuestas (con una fila desplegada)': [
    '2 proposte in bozza o inviate · totale IVA incl.', '1 approvata · perso ', ' su 1 rifiutata',
    'Provvigione 15% · divisore 0,85', '× 0,85', 'Approvato · 1/2 siti', '−5%',
  ],
  'ficha de la propuesta': [
    'Sconto per volume (2,5%)', 'Sconto commerciale (5,00%)', 'divisore ×0,85', 'Valida fino al giorno 1 dic 2026',
    'Codice VERANO20 (20%) · in attesa di approvazione',
  ],
  'documento imprimible (Server Component)': [
    'PROPOSTA COMMERCIALE', 'Valida fino al giorno 1 dic 2026', 'Sconto per volume (2,5%)', 'MX$ 6.612,00', 'IMPIANTI',
    'Impianti senza coordinate: 1; il loro indirizzo è nella tabella.', 'ACCETTAZIONE DEL CLIENTE',
  ],
  'calculadora de spots encendida': ['3.240 spot/giorno × 30 giorni =', '97.200 spot', 'su 8 · 6 liberi', 'Loop di 4 inserzionisti (2 oggi + questa riga)'],
  'tablero de propuestas por periodo': ['1 nov 2026 – 30 nov 2026', '50%', '2 approvate hanno qualche impianto'],
  'lista filtrada sin resultados': ['Nessuna proposta approvata di Refrescos del Norte che corrisponda a «xyz». Togli il filtro per vedere tutte le proposte (1).'],
  'ficha de un borrador vencido, con catalogo de paquetes': ['Scaduta in data 1 dic 2026', 'Combo — MX$ 5.000,00 · 2 impianti', 'nessun sito approvato su 2', 'divisore ×1,00'],
}
for (const p of PANTALLAS) p.italiano = ITALIANO[p.nombre]

describe('lote PROPUESTAS · en ITALIANO', () => {
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
      expect(huellasEnItaliano(await p.pintar('it'))).toEqual([])
    })
  }

  // Validacion del lote (V2, V15): un porcentaje con decimales y conteos de
  // cuatro cifras en el tablero. Estado SOLO italiano.
  it('tablero · porcentaje con decimales y conteos con miles, en italiano', async () => {
    const { TableroPropuestas } = await import('../../components/demo/propuestas/TableroPropuestas')
    forzar(esNull, {
      periodo: { etiqueta: 'Noviembre 2026', desde: '2026-11-01', hasta: '2026-11-30' },
      conGanancia: true,
      resumen: {
        generadas: 1234, rechazadas: 1001, tasaCierre: 0.125,
        aprobadas: { n: 1500, venta: 3000, ganancia: 1000, margenPct: 33.33, gananciaPromedio: 10, sinCosto: 0 },
        porVendedor: [{ vendedor: 'Ana', generadas: 1234, aprobadas: 1500, rechazadas: 1001, venta: 3000, ganancia: 1000 }],
        lista: [],
      },
    })
    const html = texto(pintar('it', createElement(TableroPropuestas)))
    for (const f of ['12,5%', 'margine 33,3%', '>1.234<', '>1.500<', '>1.001<']) expect(html).toContain(f)
    expect(html).not.toContain('12,5 %')
    expect(huellasEnItaliano(html)).toEqual([])
  })

  // Validacion del lote (H2): la liga publica que el cliente acepta, con
  // descuentos de volumen, comercial y de codigo con decimales.
  it('liga publica `/p/[id]` · descuentos con decimales, en italiano', async () => {
    const PUB = {
      orgNombre: 'Medios SA', orgLogoUrl: null, folio: 'P-0042', nombre: 'Propuesta Verano', estatus: 'ENVIADA',
      aceptadoEn: null, aceptadoPor: null, version: 1, clienteNombre: null, agenciaNombre: null,
      comisionPct: 15, descuentoPct: 7.5, descuentoMonto: 100, descuentoVolumenMonto: 50, descuentoVolumenPct: 2.5,
      codigoTexto: 'VERANO20', codigoDescuentoMonto: 40, codigoDescuentoPct: 12.5, paquete: null,
      divisor: 0.85, bruto: 6000, base: 5000, neto: 4250, iva: 800, total: 5800, itemsAprobados: 1,
      vigenteHasta: '2026-12-01', vencida: false, condiciones: null,
      items: [
        { sitioNombre: 'Pantalla Reforma', alcaldia: 'Cuauhtémoc', ciudad: 'CDMX', estado: null, tipoMedio: 'PANTALLA_DIGITAL',
          lat: 19.4, lng: -99.1, direccion: 'Reforma 1', fechaInicio: '2026-11-01', fechaFin: '2026-11-30', precio: 1000, aprobado: true },
      ],
    }
    forzar((v) => v === undefined, PUB)
    const { default: Pagina } = await import('../../app/(app)/p/[id]/page')
    const html = texto(pintar('it', createElement(Pagina, { params: { id: 'p1' } })))
    for (const f of ['Sconto per volume (2,5%)', 'Sconto (7,5%)', 'Codice VERANO20 (12,5%)']) expect(html).toContain(f)
    expect(html).not.toMatch(/\(\d+\.\d%\)/)
  })

  it('barrido: ningun trozo espanol ni ingles de `propuestas.*` en el HTML italiano', async () => {
    const { ES_PROPUESTAS, EN_PROPUESTAS, IT_PROPUESTAS } = await import('./textos/propuestas')
    const IT = IT_PROPUESTAS as Record<string, string | undefined>
    let html = ''
    for (const p of PANTALLAS) {
      forzado.cola = []
      datos.propuestas = [PROPUESTA]
      datos.contratos = []
      html += legible(await p.pintar('it'))
    }
    // Las condiciones del dato de prueba y los nombres son DATO, no interfaz.
    // Ni lo que pinta OTRO ambito y aun cae al ingles («Loop slots go from…»
    // contiene el «Loop slots» de este lote).
    const ajenas = [...AJENAS_IT].map((x) => x.replace(/^>|<$/g, ''))
    for (const d of ['Pago a 30 días.', 'Campaña Navidad', 'Refrescos del Norte', 'Agencia Uno', 'Pantalla Reforma', ...ajenas]) {
      html = html.split(d).join('\n')
    }
    const culpables: string[] = []
    let vistos = 0
    for (const [clave, es] of Object.entries(ES_PROPUESTAS)) {
      // El codigo de ejemplo coincide con el del dato de prueba.
      if (clave === 'propuestas.codigo.ejemplo') continue
      const it = IT[clave] ?? ''
      const en = EN_PROPUESTAS[clave as keyof typeof EN_PROPUESTAS]
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
    expect(vistos).toBeGreaterThan(200)
  })
})

// ─── ADR 0049 · el documento imprimible va en el idioma de la INSTANCIA ─────
// Decision del dueno (03/11): «todo debe salir en el idioma que se configuro
// el programa». Fuera de PANTALLAS a proposito: aqui el ingles de la persona
// convive con un papel en espanol, y los barridos de esa lista lo tomarian
// por una traduccion olvidada.
describe('ADR 0049 · el documento imprimible de la propuesta, en el idioma de la instancia', () => {
  async function documento(persona: 'es' | 'en', deLaInstancia: 'es' | 'en' | 'it') {
    cabeceras.cookie = persona
    instancia.idioma = deLaInstancia
    try {
      const { default: Documento } = await import('../../app/(app)/propuesta/[id]/page')
      const el = await Documento({ params: { id: 'p1' } })
      forzar((v) => v === '', 'https://ejemplo.mx/spaces-dooh/p/tok/') // la liga del QR
      return texto(pintar(persona, el))
    } finally {
      instancia.idioma = null
      cabeceras.cookie = null
    }
  }

  it('instancia ESPANOLA, persona en ingles: el papel en espanol, la barra en ingles', async () => {
    const html = await documento('en', 'es')
    for (const f of ['PROPUESTA COMERCIAL', 'ACEPTA EL CLIENTE', 'Válida hasta el 01/12/2026']) {
      expect(html, f).toContain(f)
    }
    expect(html).not.toContain('COMMERCIAL PROPOSAL')
    // La liga con su QR es de CLIENTE y va dentro del papel: tambien en espanol.
    expect(html).toContain(traducir('es', 'propuestas.documento.qr.acepta'))
    expect(html).toContain('Back to the proposal')
  })

  it('instancia INGLESA, persona en espanol: el papel en ingles, la barra en espanol', async () => {
    const html = await documento('es', 'en')
    for (const f of ['COMMERCIAL PROPOSAL', 'CLIENT ACCEPTANCE', 'Valid until Dec 1, 2026']) {
      expect(html, f).toContain(f)
    }
    expect(html).not.toContain('PROPUESTA COMERCIAL')
    expect(html).toContain(traducir('en', 'propuestas.documento.qr.acepta'))
    expect(html).toContain('Volver a la propuesta')
  })

  // B67 · con el italiano integrado, una instancia `it` pinta el papel en
  // italiano aunque la persona trabaje en espanol.
  it('instancia ITALIANA, persona en espanol: el papel en italiano, la barra en espanol', async () => {
    const antes = process.env.IDIOMA_ITALIANO
    process.env.IDIOMA_ITALIANO = '1'
    try {
      const html = await documento('es', 'it')
      for (const f of ['PROPOSTA COMMERCIALE', 'ACCETTAZIONE DEL CLIENTE', 'Valida fino al giorno 1 dic 2026']) {
        expect(html, f).toContain(f)
      }
      expect(html).not.toContain('PROPUESTA COMERCIAL')
      expect(html).not.toContain('COMMERCIAL PROPOSAL')
      expect(html).toContain(traducir('it', 'propuestas.documento.qr.acepta'))
      expect(html).toContain('Volver a la propuesta')
    } finally {
      if (antes === undefined) delete process.env.IDIOMA_ITALIANO
      else process.env.IDIOMA_ITALIANO = antes
    }
  })
})

// ─── B72 (pulido del italiano, 04/11) · el papel declara su `lang` ──────────
// Como `/p` y el portal (B68), pero SOLO cuando el idioma de la instancia no es
// el de la persona: el lector de pantalla lee el papel con su voz, y el HTML
// de hoy (instancia y persona en espanol) no cambia ni un byte.
describe('B72 · la propuesta imprimible lleva su propio lang cuando difiere', () => {
  async function html(persona: 'es' | 'en' | 'it', deLaInstancia: 'es' | 'en' | 'it') {
    const antes = process.env.IDIOMA_ITALIANO
    process.env.IDIOMA_ITALIANO = '1'
    cabeceras.cookie = persona
    instancia.idioma = deLaInstancia
    try {
      const { default: Documento } = await import('../../app/(app)/propuesta/[id]/page')
      const el = await Documento({ params: { id: 'p1' } })
      forzar((v) => v === '', 'https://ejemplo.mx/spaces-dooh/p/tok/')
      return pintar(persona, el)
    } finally {
      instancia.idioma = null
      cabeceras.cookie = null
      if (antes === undefined) delete process.env.IDIOMA_ITALIANO
      else process.env.IDIOMA_ITALIANO = antes
    }
  }
  it.each([
    ['es', 'it'],
    ['en', 'es'],
    ['es', 'en'],
  ] as const)('persona en %s, instancia en %s: el papel con lang de la instancia', async (persona, deLaInstancia) => {
    const h = await html(persona, deLaInstancia)
    expect(h).toContain(`<div lang="${deLaInstancia}" style="display:contents"><article class="doc-hoja doc-comercial">`)
    // La barra (no se imprime) queda fuera del envoltorio.
    expect(h.indexOf('lang=')).toBeGreaterThan(h.indexOf(traducir(persona, 'propuestas.documento.volver')))
  })
  it.each(['es', 'en', 'it'] as const)('persona e instancia en %s: sin envoltorio', async (mismo) => {
    expect(await html(mismo, mismo)).not.toContain('lang=')
  })
})

// ─── B79 (supervision de cifras por idioma, 04/11) · la guardia de la calculadora ─
// En italiano la prima, las horas y los espacios van por `EntradaCifra`: lo
// ilegible llega como 'NaN'. Las horas y los espacios ilegibles ya los
// rechaza la propia calculadora; la PRIMA no: `primaDe` la dejaba en 0 en
// silencio y el Roadblock salia sin su maggiorazione. Solo la guardia de
// `errCifras` la para. Para que el Roadblock sea valido, la pantalla tiene
// aqui los 8 slots libres.
describe('B79 · la prima ilegible de la calculadora para el alta en italiano', () => {
  const linea = (prima: string) => ({
    s1: {
      unidad: 'spot', cantidadManual: 1, spotsPorDia: '', rentaMonto: '', rentaPeriodicidad: 'MENSUAL',
      rentaArrendadorId: '', franjaId: '', tarifaManual: '', manual: false, espacios: '8', horasDia: '',
      roadblock: true, prima,
    },
  })
  async function alta(idioma: Idioma, prima: string) {
    const { default: Pagina } = await import('../../app/(app)/(shell)/propuestas/page')
    const libres = SITIO_DIGITAL.spotsDisponibles
    SITIO_DIGITAL.spotsDisponibles = SITIO_DIGITAL.totalSpots
    try {
      forzar(esNull, { tipo: 'duplicar', propuesta: PROPUESTA })
      forzar((v) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0, linea(prima))
      return pintar(idioma, createElement(Pagina))
    } finally {
      SITIO_DIGITAL.spotsDisponibles = libres
    }
  }
  const aviso = (idioma: Idioma) =>
    traducir(idioma, 'propuestas.alta.error.calculadora', { sitio: SITIO_DIGITAL.nombre })

  it('ITALIANO · una prima ilegible («NaN» del campo) se dice y no deja crear', async () => {
    const html = await alta('it', 'NaN')
    expect(html).toContain(aviso('it'))
    expect(html).toMatch(/<button disabled=""[^>]*>Crea proposta<\/button>/)
  })
  it('ITALIANO · la prima que se entiende no da el aviso', async () => {
    expect(await alta('it', '12.5')).not.toContain(aviso('it'))
  })
  it('ESPAÑOL e INGLÉS · nunca: lo de siempre', async () => {
    expect(await alta('es', 'NaN')).not.toContain(aviso('es'))
    expect(await alta('en', 'NaN')).not.toContain(aviso('en'))
  })
})

// ============================================================================
//  LOTE L2 DEL PORTUGUES (2026-11-05) · las mismas pantallas, en portugues.
//  Barrido con el diccionario (ningun trozo espanol ni ingles de
//  `propuestas.*` ni `codigos.*`, sin el espanol pendiente de OTROS lotes),
//  ninguna huella de formato ajeno (`guardias-portugues.ts`) y el portugues
//  esperado donde hay concordancia o formato. El documento imprimible entra
//  como 'pt' con el portugues encendido: es el papel de una instancia `pt`
//  (tarea P3), que aqui sigue a la cookie.
// ============================================================================
const DATOS_PT = ['Pago a 30 días.', 'Campaña Navidad', 'Refrescos del Norte', 'Agencia Uno', 'Pantalla Reforma', 'VERANO20']

const PORTUGUES: Record<string, string[]> = {
  'lista de propuestas (con una fila desplegada)': [
    '2 propostas em rascunho ou enviadas · total c/ IVA', '1 aprovada · perdido ', ' em 1 recusada',
    'Comissão 15% · divisor 0,85', '× 0,85', 'Aprovado · 1/2 pontos', '−5%', 'Código pendente',
  ],
  'ficha de la propuesta': [
    'Desconto por volume (2,5%)', 'Desconto comercial (5,00%)', 'divisor ×0,85', 'Válida até 1 de dez. de 2026',
    'Código VERANO20 (20%) · código aguardando aprovação', 'Ref. interna: ', 'Líquido para o veículo',
  ],
  'documento imprimible (Server Component)': [
    'PROPOSTA COMERCIAL', 'Válida até 1 de dez. de 2026', 'Desconto por volume (2,5%)', 'MX$ 6.612,00', 'PONTOS',
    '1 ponto(s) sem coordenadas; o endereço está na tabela.', 'ACEITE DO CLIENTE', 'Comissão de agência (15%)',
  ],
  'calculadora de spots encendida': [
    '3.240 spots/dia × 30 dias = ', '97.200 spots', 'de 8 · 6 livres', 'Loop de 4 anunciantes (2 hoje + esta linha)', '90 loops/h',
  ],
  'tablero de propuestas por periodo': [
    '1 de nov. de 2026 a 30 de nov. de 2026', '50%', '2 aprovadas têm algum ponto sem contrato de locação vigente', 'Data de aprovação',
  ],
  'lista filtrada sin resultados': [
    'Nenhuma proposta aprovada de Refrescos del Norte que corresponda a “xyz”. Remova o filtro para ver todas (1).',
  ],
  'ficha de un borrador vencido, con catalogo de paquetes': [
    'Vencida desde 1 de dez. de 2026', 'Combo — MX$ 5.000,00 · 2 pontos', 'nenhum ponto aprovado de 2', 'divisor ×1,00',
    'Vencida desde 1 de dez. de 2026: o link não permite mais aceitá-la.',
  ],
}

describe('lote L2 · PROPUESTAS en PORTUGUES', () => {
  async function diccionarios() {
    const { ES_PROPUESTAS, EN_PROPUESTAS, PT_PROPUESTAS } = await import('./textos/propuestas')
    const { ES_CODIGOS, EN_CODIGOS, PT_CODIGOS } = await import('./textos/codigos')
    return {
      es: { ...ES_PROPUESTAS, ...ES_CODIGOS } as Record<string, string>,
      en: { ...EN_PROPUESTAS, ...EN_CODIGOS } as Record<string, string>,
      it: { ...PT_PROPUESTAS, ...PT_CODIGOS } as Partial<Record<string, string>>,
    }
  }

  beforeEach(() => {
    process.env.IDIOMA_PORTUGUES = '1'
  })
  afterEach(() => {
    delete process.env.IDIOMA_PORTUGUES
  })

  it('las frases portuguesas declaradas son de pantallas que existen', () => {
    const nombres = new Set(PANTALLAS.map((p) => p.nombre))
    expect(Object.keys(PORTUGUES).filter((n) => !nombres.has(n))).toEqual([])
  })

  for (const p of PANTALLAS) {
    it(`${p.nombre} · sin espanol ni ingles del lote, sin formatos ajenos`, async () => {
      const crudo = await p.pintar('pt')
      volcarPt(p.nombre, crudo)
      expect(culpablesEnItaliano(crudo, await diccionarios(), { ignorar: [...DATOS_PT, ...espanolPendienteDeOtrosLotes()] })).toEqual([])
      expect(huellasEnPortugues(crudo)).toEqual([])
      const html = texto(crudo)
      expect((PORTUGUES[p.nombre] ?? []).filter((f) => !html.includes(f))).toEqual([])
    })
  }

  // La leccion del italiano L2 (V2, V15): un porcentaje con decimales y
  // conteos de cuatro cifras en el tablero. Estado SOLO portugues.
  it('tablero · porcentaje con decimales y conteos con miles, en portugues', async () => {
    const { TableroPropuestas } = await import('../../components/demo/propuestas/TableroPropuestas')
    forzar(esNull, {
      periodo: { etiqueta: 'Noviembre 2026', desde: '2026-11-01', hasta: '2026-11-30' },
      conGanancia: true,
      resumen: {
        generadas: 1234, rechazadas: 1001, tasaCierre: 0.125,
        aprobadas: { n: 1500, venta: 3000, ganancia: 1000, margenPct: 33.33, gananciaPromedio: 10, sinCosto: 0 },
        porVendedor: [{ vendedor: 'Ana', generadas: 1234, aprobadas: 1500, rechazadas: 1001, venta: 3000, ganancia: 1000 }],
        lista: [],
      },
    })
    const html = texto(pintar('pt', createElement(TableroPropuestas)))
    for (const f of ['12,5%', 'margem 33,3%', '>1.234<', '>1.500<', '>1.001<']) expect(html).toContain(f)
    expect(html).not.toContain('12,5 %')
    expect(huellasEnPortugues(html)).toEqual([])
  })

  // La liga publica que el cliente acepta (la del italiano H2): descuentos de
  // volumen, comercial y de codigo con decimales, con la coma de pt-BR.
  it('liga publica `/p/[id]` · descuentos con decimales, en portugues', async () => {
    const PUB = {
      orgNombre: 'Medios SA', orgLogoUrl: null, folio: 'P-0042', nombre: 'Propuesta Verano', estatus: 'ENVIADA',
      aceptadoEn: null, aceptadoPor: null, version: 1, clienteNombre: null, agenciaNombre: null,
      comisionPct: 15, descuentoPct: 7.5, descuentoMonto: 100, descuentoVolumenMonto: 50, descuentoVolumenPct: 2.5,
      codigoTexto: 'VERANO20', codigoDescuentoMonto: 40, codigoDescuentoPct: 12.5, paquete: null,
      divisor: 0.85, bruto: 6000, base: 5000, neto: 4250, iva: 800, total: 5800, itemsAprobados: 1,
      vigenteHasta: '2026-12-01', vencida: false, condiciones: null,
      items: [
        { sitioNombre: 'Pantalla Reforma', alcaldia: 'Cuauhtémoc', ciudad: 'CDMX', estado: null, tipoMedio: 'PANTALLA_DIGITAL',
          lat: 19.4, lng: -99.1, direccion: 'Reforma 1', fechaInicio: '2026-11-01', fechaFin: '2026-11-30', precio: 1000, aprobado: true },
      ],
    }
    forzar((v) => v === undefined, PUB)
    const { default: Pagina } = await import('../../app/(app)/p/[id]/page')
    const crudo = pintar('pt', createElement(Pagina, { params: { id: 'p1' } }))
    const html = texto(crudo)
    for (const f of ['Desconto por volume (2,5%)', 'Desconto (7,5%)', 'Código VERANO20 (12,5%)', 'Tela digital']) expect(html).toContain(f)
    expect(html).not.toMatch(/\(\d+\.\d%\)/)
    expect(huellasEnPortugues(crudo)).toEqual([])
  })
})

function volcarPt(nombre: string, html: string) {
  const dir = process.env.VOLCAR_HTML
  if (!dir) return
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, `${nombre.replace(/[^\w]+/g, '_')}_en_PORTUGUES.html`), html)
}
